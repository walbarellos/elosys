"""A cheap LLM second opinion on detection signals (DeepSeek)."""

from __future__ import annotations

import json
import sqlite3
import time

from ..ai.deepseek import DEFAULT_MODEL, DeepSeekError, chat_json
from ..log import RowCounter, get_logger, step
from ..util import now_utc

log = get_logger("elosys.rules.ai_review")

REVIEWABLE_RULES = ("circular_donations", "disproportionate_expense")
DEFAULT_LIMIT = 50
DELAY_SECONDS = 0.3
VERDICTS = {"bizarro", "plausivel", "inconclusivo"}
CONFIDENCES = {"baixa", "media", "alta"}

SYSTEM_PROMPT = (
    "Você analisa SINAIS DE ALERTA gerados por um sistema sobre dados PÚBLICOS de "
    "financiamento de campanha eleitoral no Brasil (prestação de contas do TSE). "
    "Os sinais NÃO são acusação — são indícios que precisam de checagem humana. "
    "Seu trabalho é TRIAR: dizer se esse caso específico merece ou não a atenção "
    "de um humano. É uma decisão de priorização, não um julgamento.\n\n"
    "Responda SEMPRE com um objeto JSON, e só ele:\n"
    "{\n"
    '  "verdict": "bizarro" | "plausivel" | "inconclusivo",\n'
    '  "confianca": "baixa" | "media" | "alta",\n'
    '  "explicacao": "2 a 4 frases em português, objetivas, citando os fatos que pesaram",\n'
    '  "fatos": ["ponto concreto 1", "ponto concreto 2", "..."]\n'
    "}\n\n"
    "- \"plausivel\": dá pra explicar por um padrão comum e legítimo — mesma "
    "coligação/partido, conta nacional do partido repassando recursos aos próprios "
    "candidatos, devolução de sobra, doação entre aliados do mesmo grupo, compra em "
    "lote, preço dentro do razoável pro item.\n"
    "- \"bizarro\": tem pelo menos UM fato que dificulta a explicação simples e "
    "justifica um humano olhar — por exemplo: ciclo curto e fechado entre pessoas "
    "SEM partido/coligação em comum; empresa que doou milhões e recebeu de volta "
    "quase o mesmo; fornecedor cujo ramo não tem nada a ver com o serviço; valor "
    "de uma ordem de grandeza acima do resto das transações da cadeia; preço muito "
    "acima de mercado sem lote que justifique. Não precisa de prova — precisa de um "
    "fato concreto que você consiga nomear.\n"
    "- \"inconclusivo\": os fatos não apontam nem pra um lado nem pro outro.\n\n"
    "NUNCA afirme que houve crime, fraude ou irregularidade — \"bizarro\" quer dizer "
    "\"vale conferir\", não \"é culpado\". Mas também NÃO se esconda no "
    "\"inconclusivo\": se há um fato que chama atenção, diga \"bizarro\" e nomeie o "
    "fato. Reserve \"inconclusivo\" pros casos em que realmente não dá pra dizer nada."
)


def run(
    con: sqlite3.Connection,
    *,
    model: str = DEFAULT_MODEL,
    limit: int = DEFAULT_LIMIT,
    rules: tuple[str, ...] = REVIEWABLE_RULES,
    refresh: bool = False,
    order: str = "amount",
    min_amount_cents: int = 0,
    state: str | None = None,
    municipality: str | None = None,
) -> dict:
    by_verdict: dict[str, int] = {}
    reviewed = 0
    errors = 0

    for rule in rules:
        if rule not in REVIEWABLE_RULES:
            log.warning("regra desconhecida, pulando: %s", rule)
            continue
        location_desc = f", state {state}" if state else ""
        if municipality:
            location_desc += f", municipality {municipality}"
        with step(log, f"{rule}: selecionar sinais (limit {limit}, order {order}{location_desc})"):
            targets = _select_signals(
                con, rule, model, limit, refresh, order, min_amount_cents,
                state=state, municipality=municipality,
            )
        log.info("  %s sinais para revisar", len(targets))

        rc = RowCounter(log, f"{rule} revisados", every=10)
        consecutive_errors = 0
        for signal_id, explanation in targets:
            rc.tick()
            facts = _facts_for(con, rule, signal_id, explanation)
            user_prompt = _user_prompt(rule, facts)
            try:
                out = chat_json(SYSTEM_PROMPT, user_prompt, model=model)
            except DeepSeekError as e:
                errors += 1
                consecutive_errors += 1
                log.warning("sinal %d: %s", signal_id, e)
                if consecutive_errors >= 3:
                    log.error("3 erros seguidos — abortando (chave inválida? sem créditos?)")
                    con.commit()
                    return _summary(reviewed, by_verdict, errors, aborted=True)
                continue
            consecutive_errors = 0

            verdict, confidence, model_explanation, model_facts = _parse(out["data"])
            con.execute(
                "INSERT INTO signal_ai_review (signal_id, model, reviewed_at, verdict, confidence, "
                "explanation, facts, prompt, raw_response, tokens_prompt, tokens_completion) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                "ON CONFLICT (signal_id, model) DO UPDATE SET "
                "reviewed_at=excluded.reviewed_at, verdict=excluded.verdict, "
                "confidence=excluded.confidence, explanation=excluded.explanation, "
                "facts=excluded.facts, prompt=excluded.prompt, raw_response=excluded.raw_response, "
                "tokens_prompt=excluded.tokens_prompt, tokens_completion=excluded.tokens_completion",
                (
                    signal_id, model, now_utc(), verdict, confidence, model_explanation,
                    json.dumps(model_facts, ensure_ascii=False), user_prompt, out["raw"],
                    out["prompt_tokens"], out["completion_tokens"],
                ),
            )
            by_verdict[verdict] = by_verdict.get(verdict, 0) + 1
            reviewed += 1
            if reviewed % 25 == 0:
                con.commit()
            time.sleep(DELAY_SECONDS)
        rc.done()
        con.commit()

    return _summary(reviewed, by_verdict, errors)


def _summary(reviewed: int, by_verdict: dict, errors: int, *, aborted: bool = False) -> dict:
    out = {"reviewed": reviewed, "by_verdict": by_verdict, "errors": errors}
    if aborted:
        out["aborted"] = True
    log.info("done: %d revisados %s (%d erros)%s",
             reviewed, by_verdict, errors, " — ABORTADO" if aborted else "")
    return out


def _select_signals(
    con: sqlite3.Connection, rule: str, model: str, limit: int, refresh: bool,
    order: str, min_amount_cents: int,
    state: str | None = None,
    municipality: str | None = None,
) -> list[tuple[int, str]]:
    extra_filter = ""
    extra_params: list = []
    if state:
        extra_filter = (
            "AND s.id IN ("
            "  SELECT sa.signal_id FROM signal_actor sa "
            "  JOIN people pe ON pe.id = sa.actor_id AND sa.type = 'person' "
            "  JOIN politician_history ph ON ph.person_id = pe.id "
            "  WHERE ph.state = ?"
        )
        extra_params.append(state)
        if municipality:
            extra_filter += " AND ph.municipality = ?"
            extra_params.append(municipality)
        extra_filter += ")"

    if refresh:
        con.execute(
            f"DELETE FROM signal_ai_review WHERE model = ? AND signal_id IN "
            f"(SELECT s.id FROM signal s JOIN rule_run r ON r.id = s.rule_run_id WHERE r.rule = ? {extra_filter})",
            (model, rule, *extra_params),
        )
    amount_expr = (
        "coalesce(s.amount_cents, 0)"
        if rule == "circular_donations"
        else ("(SELECT ce.amount_cents FROM signal_evidence se "
               "JOIN campaign_expense ce ON ce.id = se.record_id "
               "WHERE se.signal_id = s.id AND se.table_name = 'campaign_expense' LIMIT 1)")
    )
    if rule == "circular_donations" and order == "tight":
        order_by = f"coalesce(s.path_length, 99) ASC, {amount_expr} DESC"
    else:
        order_by = f"{amount_expr} DESC"
    rows = con.execute(
        f"SELECT s.id, s.explanation FROM signal s "  # noqa: S608
        f"JOIN rule_run r ON r.id = s.rule_run_id "
        f"WHERE r.rule = ? AND s.id NOT IN (SELECT signal_id FROM signal_ai_review WHERE model = ?) "
        f"AND {amount_expr} >= ? {extra_filter} "
        f"ORDER BY {order_by} LIMIT ?",
        (rule, model, min_amount_cents, *extra_params, limit),
    ).fetchall()
    return [(r["id"], r["explanation"]) for r in rows]


def _facts_for(con: sqlite3.Connection, rule: str, signal_id: int, explanation: str) -> dict:
    if rule == "circular_donations":
        return _circular_facts(con, signal_id, explanation)
    return _disproportionate_facts(con, signal_id, explanation)


def _candidacy_blurb(con: sqlite3.Connection, person_id: int) -> dict:
    row = con.execute(
        "SELECT party_abbr, office, state, group_concat(DISTINCT year) AS years "
        "FROM politician_history WHERE person_id = ? "
        "GROUP BY person_id ORDER BY max(year) DESC LIMIT 1",
        (person_id,),
    ).fetchone()
    if not row:
        return {}
    return {
        "partido": row["party_abbr"],
        "cargo": row["office"],
        "uf": row["state"],
        "anos": row["years"],
    }


def _circular_facts(con: sqlite3.Connection, signal_id: int, explanation: str) -> dict:
    entities = []
    for a in con.execute(
        "SELECT sa.type, sa.actor_id FROM signal_actor sa WHERE sa.signal_id = ?", (signal_id,)
    ).fetchall():
        if a["type"] == "person":
            p = con.execute(
                "SELECT id, canonical_name FROM people WHERE id = ?", (a["actor_id"],)
            ).fetchone()
            if p:
                entities.append({"nome": p["canonical_name"], **_candidacy_blurb(con, p["id"])})
        else:
            c = con.execute(
                "SELECT coalesce(cr.legal_name, c.legal_name) AS name FROM companies c "
                "LEFT JOIN company_registry cr ON cr.company_id = c.id WHERE c.id = ?",
                (a["actor_id"],),
            ).fetchone()
            if c:
                entities.append({"nome": c["name"], "tipo": "empresa"})

    transactions: dict[tuple, dict] = {}
    for e in con.execute(
        "SELECT table_name, record_id FROM signal_evidence WHERE signal_id = ?", (signal_id,)
    ).fetchall():
        if e["table_name"] == "campaign_donation":
            row = con.execute(
                "SELECT d.amount_cents, d.year, d.donor_name AS de, p.canonical_name AS para "
                "FROM campaign_donation d JOIN campaign_org co ON co.id = d.campaign_org_id "
                "JOIN people p ON p.id = co.person_id WHERE d.id = ?",
                (e["record_id"],),
            ).fetchone()
            tipo = "doação"
        elif e["table_name"] == "campaign_expense":
            row = con.execute(
                "SELECT ce.amount_cents, ce.year, p.canonical_name AS de, ce.supplier_name AS para "
                "FROM campaign_expense ce JOIN campaign_org co ON co.id = ce.campaign_org_id "
                "JOIN people p ON p.id = co.person_id WHERE ce.id = ?",
                (e["record_id"],),
            ).fetchone()
            tipo = "despesa"
        else:
            continue
        if not row:
            continue
        key = (row["de"], row["para"], tipo)
        acc = transactions.setdefault(
            key, {"de": row["de"], "para": row["para"], "tipo": tipo,
                  "valor_cents": 0, "qtd": 0, "anos": set()}
        )
        acc["valor_cents"] += row["amount_cents"] or 0
        acc["qtd"] += 1
        if row["year"]:
            acc["anos"].add(row["year"])

    txs = []
    for t in transactions.values():
        t["anos"] = sorted(t["anos"])
        txs.append(t)

    return {"resumo": explanation, "entidades": entities, "transacoes": txs}


def _disproportionate_facts(con: sqlite3.Connection, signal_id: int, explanation: str) -> dict:
    ev = con.execute(
        "SELECT ce.description, ce.origin, ce.amount_cents, ce.year, ce.supplier_name, "
        "       ce.supplier_cpf_cnpj, co.person_id AS candidate_person_id, "
        "       p.canonical_name AS candidate_name "
        "FROM signal_evidence se JOIN campaign_expense ce ON ce.id = se.record_id "
        "LEFT JOIN campaign_org co ON co.id = ce.campaign_org_id "
        "LEFT JOIN people p ON p.id = co.person_id "
        "WHERE se.signal_id = ? AND se.table_name = 'campaign_expense' LIMIT 1",
        (signal_id,),
    ).fetchone()
    if not ev:
        return {"resumo": explanation}
    facts = {
        "resumo": explanation,
        "descricao_item": ev["description"],
        "categoria_tse": ev["origin"],
        "valor_contratado_cents": ev["amount_cents"],
        "ano": ev["year"],
        "fornecedor": ev["supplier_name"],
        "fornecedor_cnpj": ev["supplier_cpf_cnpj"],
    }
    if ev["candidate_person_id"]:
        facts["candidato"] = {
            "nome": ev["candidate_name"], **_candidacy_blurb(con, ev["candidate_person_id"])
        }
    return facts


def _user_prompt(rule: str, facts: dict) -> str:
    kind = (
        "DOAÇÃO CIRCULAR (loop de movimentação de campanha: o dinheiro sai de uma "
        "campanha e, seguindo doações e despesas, volta pra mesma cadeia)"
        if rule == "circular_donations"
        else "DESPESA DE CAMPANHA DESPROPORCIONAL (item tipicamente barato — caneta, "
             "adesivo, crachá... — contratado por valor alto)"
    )
    return (
        f"Tipo de sinal: {kind}.\n\n"
        f"Fatos (JSON):\n{json.dumps(facts, ensure_ascii=False, indent=2, default=str)}\n\n"
        "Com base SÓ nesses fatos, esse sinal é rotineiro/explicável ou genuinamente "
        "estranho? Responda no formato JSON pedido."
    )


def _parse(data: dict) -> tuple[str, str | None, str, list]:
    verdict = str(data.get("verdict", "")).strip().lower()
    if verdict not in VERDICTS:
        verdict = "inconclusivo"
    confidence = str(data.get("confianca", "")).strip().lower() or None
    if confidence not in CONFIDENCES:
        confidence = None
    explanation = str(data.get("explicacao") or data.get("explanation") or "").strip()
    if not explanation:
        explanation = "(modelo não devolveu explicação)"
    facts = data.get("fatos") or data.get("facts") or []
    if not isinstance(facts, list):
        facts = [str(facts)]
    return verdict, confidence, explanation, [str(f) for f in facts]
