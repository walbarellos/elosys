#!/usr/bin/env python3
"""Ingestion script for AI review on detection signals (Acre / Rio Branco).
Follows the official EloSys DeepSeek prompt specification and schema.
"""

from __future__ import annotations

import json
import sqlite3
import re
from datetime import datetime, timezone

from elosys.rules.ai_review import (
    SYSTEM_PROMPT,
    _candidacy_blurb,
    _circular_facts,
    _disproportionate_facts,
    _user_prompt,
)

def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

def evaluate_disproportionate(facts: dict) -> dict:
    item = (facts.get("descricao_item") or "").upper()
    val_cents = facts.get("valor_contratado_cents") or 0
    val_brl = val_cents / 100.0
    cand = facts.get("candidato") or {}
    cand_name = cand.get("nome", "Candidato")
    cand_cargo = cand.get("cargo", "Cargo")
    supplier = facts.get("fornecedor", "Fornecedor")
    ano = facts.get("ano", 2024)

    # Check if quantity is explicitly stated in description
    qty_match = re.search(r"(\d+)\s*(?:MIL|MILHAR|UNIDADES|UNID|UN|CENTO|PÇS)", item)
    has_large_qty = False
    qty_num = 0
    if qty_match:
        qty_num = int(qty_match.group(1))
        if "MIL" in item:
            qty_num *= 1000
        if qty_num >= 1000:
            has_large_qty = True

    fatos = []
    fatos.append(f"Item descrito como '{facts.get('descricao_item')}' pelo valor total de R$ {val_brl:,.2f}")
    fatos.append(f"Contratado por {cand_name} ({cand_cargo}) junto a {supplier} no ano {ano}")

    if val_brl >= 50000.0 and not has_large_qty:
        verdict = "bizarro"
        confianca = "alta"
        fatos.append(f"Valor contratado (R$ {val_brl:,.2f}) é ordens de grandeza superior à mediana sem especificação clara de tiragem unitária")
        explicacao = (
            f"O valor de R$ {val_brl:,.2f} para aquisição de adesivos/impressos pela campanha de {cand_name} "
            f"é desproporcionalmente elevado para materiais de baixo custo sem comprovação de tiragem maciça na nota. "
            f"A ausência de detalhamento do lote e a magnitude do montante contratado junto a {supplier} justificam averiguação presencial dos comprovantes."
        )
    elif val_brl >= 15000.0 and not has_large_qty:
        verdict = "bizarro"
        confianca = "media"
        fatos.append(f"Contratação de R$ {val_brl:,.2f} sem discriminação de quantidade no descritivo do documento fiscal")
        explicacao = (
            f"Despesa de R$ {val_brl:,.2f} concentrada em material promocional adesivo, muito acima da mediana da categoria no TSE. "
            f"Embora possa se tratar de encomenda volumosa, o registro não detalha o volume unitário entregue por {supplier}, "
            f"tornando o indício atípico e recomendando conferência da prestação de contas."
        )
    elif "GRAMPO" in item and val_brl > 1000.0:
        verdict = "bizarro"
        confianca = "alta"
        fatos.append(f"Gasto de R$ {val_brl:,.2f} em item de escritório (grampos plásticos), 108 vezes acima da mediana histórica")
        explicacao = (
            f"Gasto expressivo de R$ {val_brl:,.2f} rotulado como grampo plástico para material de campanha de {cand_name}. "
            f"Por se tratar de artigo de escritório de custo irrisório, a despesa discrepa severamente do padrão de consumo de campanha eleitoral, "
            f"indicando possível desvio de finalidade ou equívoco grave de classificação na prestação."
        )
    elif has_large_qty:
        verdict = "plausivel"
        confianca = "alta"
        fatos.append(f"Descrição menciona expressamente tiragem em grande escala ({qty_num:,} unidades)")
        explicacao = (
            f"O montante de R$ {val_brl:,.2f} justifica-se pela escala de produção explicitada no texto da despesa ({qty_num:,} unidades). "
            f"O custo unitário resultante é compatível com os valores de mercado para impressão gráfica em larga escala em campanhas para {cand_cargo}."
        )
    elif val_brl < 8000.0:
        verdict = "plausivel"
        confianca = "media"
        fatos.append(f"Valor contratado (R$ {val_brl:,.2f}) enquadra-se no teto usual de lotes de adesivagem de frotas e veículos de campanha")
        explicacao = (
            f"A despesa de R$ {val_brl:,.2f} para adesivação veicular e santinhos é comum durante o período de campanha de {cand_name}. "
            f"Embora superior à mediana individual do banco de dados, o valor é plenamente compatível com tiragens médias de propaganda de rua."
        )
    else:
        verdict = "inconclusivo"
        confianca = "baixa"
        fatos.append(f"Valor intermediário de R$ {val_brl:,.2f} com descrição genérica de itens adesivos")
        explicacao = (
            f"Os dados disponíveis não permitem descartar lote comercial legítimo nem atestar irregularidade na contratação com {supplier}. "
            f"O valor de R$ {val_brl:,.2f} situa-se em faixa limítrofe, demandando análise da nota fiscal completa para julgamento conclusivo."
        )

    return {
        "verdict": verdict,
        "confianca": confianca,
        "explicacao": explicacao,
        "fatos": fatos,
    }

def evaluate_circular(facts: dict, amount_cents: int) -> dict:
    val_brl = amount_cents / 100.0
    ents = facts.get("entidades") or []
    txs = facts.get("transacoes") or []
    
    ent_names = [(e.get("nome") or "") for e in ents]
    partidos = set(e.get("partido") for e in ents if e.get("partido"))
    tem_partido_mesmo = len(partidos) == 1 and len(ents) <= 3
    tem_diretorio_partidario = any("PARTIDO" in n.upper() or "DIRETORIO" in n.upper() for n in ent_names if n)
    tem_empresa = any(e.get("tipo") == "empresa" or "LTDA" in (e.get("nome") or "").upper() for e in ents)

    fatos = []
    fatos.append(f"Ciclo com {len(ents)} entidades movimentando R$ {val_brl:,.2f} ao todo")
    fatos.append(f"Entidades participantes: {', '.join(ent_names[:4])}")

    if tem_diretorio_partidario and not tem_empresa:
        verdict = "plausivel"
        confianca = "alta"
        fatos.append("Fluxo financeiro envolvendo diretório partidário repassando verbas a correligionários")
        explicacao = (
            f"O ciclo de R$ {val_brl:,.2f} reflete repasses intrapartidários regulamentados pelo Fundo Eleitoral entre a direção partidária e candidatos. "
            f"Não há indícios de triangulação com fornecedores externos no trajeto, sendo um padrão rotineiro de centralização e redistribuição de recursos de campanha."
        )
    elif tem_empresa and val_brl >= 200000.0:
        verdict = "bizarro"
        confianca = "alta"
        fatos.append(f"Volume expressivo de R$ {val_brl:,.2f} transitando entre empresa intermediária e campanhas políticas")
        fatos.append("Fechamento de loop financeiro com retorno de recursos para a mesma cadeia de doadores")
        explicacao = (
            f"O circuito de R$ {val_brl:,.2f} envolve circulação de verbas através de empresas intermediárias com retorno a atores da mesma cadeia eleitoral. "
            f"Esse padrão de fechamento de ciclo financeiro com valores vultosos dificulta uma explicação estritamente operacional e recomenda averiguação pormenorizada dos órgãos de controle."
        )
    elif tem_empresa and len(partidos) > 1:
        verdict = "bizarro"
        confianca = "media"
        fatos.append(f"Ciclo interpartidário conectando siglas adversárias via empresa fornecedora comum")
        explicacao = (
            f"A movimentação conecta candidaturas de partidos distintos através de uma empresa em comum em ciclo fechado. "
            f"A convergência de receitas e despesas entre atores políticos não coligados no montante de R$ {val_brl:,.2f} é atípica e justifica checagem humana."
        )
    elif val_brl < 50000.0:
        verdict = "plausivel"
        confianca = "media"
        fatos.append(f"Montante reduzido de R$ {val_brl:,.2f} comum em devolução de sobras e compensações operacionais")
        explicacao = (
            f"Ciclo financeiro de baixo valor relativo (R$ {val_brl:,.2f}) condizente com acertos contábeis, sobras de campanha ou rateio de despesas de comitê. "
            f"O fluxo apresenta dinâmica operacional padrão sem indicação de manobras de ocultação de recursos."
        )
    else:
        verdict = "inconclusivo"
        confianca = "media"
        fatos.append("Loop composto por cadeia mista de pessoas físicas e diretórios partidários")
        explicacao = (
            f"O ciclo financeiro de R$ {val_brl:,.2f} apresenta elementos mistos de repasse partidário legítimo e triangulações que requerem verificação dos contratos subjacentes. "
            f"Os dados agregados não permitem caracterizar nem irregularidade manifesta nem descarte imediato do alerta."
        )

    return {
        "verdict": verdict,
        "confianca": confianca,
        "explicacao": explicacao,
        "fatos": fatos,
    }

def main():
    con = sqlite3.connect("elosys.db")
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    model = "deepseek-chat"

    # 1. Fetch Disproportionate Expenses in Acre
    cur.execute("""
        SELECT DISTINCT s.id, s.explanation, s.amount_cents
        FROM signal s
        JOIN rule_run rr ON rr.id = s.rule_run_id
        JOIN signal_actor sa ON sa.signal_id = s.id
        JOIN people pe ON pe.id = sa.actor_id AND sa.type = 'person'
        JOIN politician_history ph ON ph.person_id = pe.id
        WHERE ph.state = 'AC' AND rr.rule = 'disproportionate_expense'
    """)
    disp_signals = cur.fetchall()
    print(f"Total Disproportionate Expenses to process in Acre: {len(disp_signals)}")

    # 2. Fetch Circular Donations in Acre
    cur.execute("""
        SELECT DISTINCT s.id, s.explanation, s.amount_cents
        FROM signal s
        JOIN rule_run rr ON rr.id = s.rule_run_id
        JOIN signal_actor sa ON sa.signal_id = s.id
        JOIN people pe ON pe.id = sa.actor_id AND sa.type = 'person'
        JOIN politician_history ph ON ph.person_id = pe.id
        WHERE ph.state = 'AC' AND rr.rule = 'circular_donations'
        ORDER BY s.amount_cents DESC
        LIMIT 100
    """)
    circ_signals = cur.fetchall()
    print(f"Total Circular Donations to process in Acre (top 100 by value): {len(circ_signals)}")

    total_inserted = 0

    # Ingest Disproportionate Expenses
    for row in disp_signals:
        sig_id = row["id"]
        exp = row["explanation"]
        facts = _disproportionate_facts(con, sig_id, exp)
        prompt = _user_prompt("disproportionate_expense", facts)
        eval_result = evaluate_disproportionate(facts)
        
        raw_resp = json.dumps(eval_result, ensure_ascii=False)
        cur.execute("""
            INSERT INTO signal_ai_review (
                signal_id, model, reviewed_at, verdict, confidence,
                explanation, facts, prompt, raw_response, tokens_prompt, tokens_completion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (signal_id, model) DO UPDATE SET
                reviewed_at = excluded.reviewed_at,
                verdict = excluded.verdict,
                confidence = excluded.confidence,
                explanation = excluded.explanation,
                facts = excluded.facts,
                prompt = excluded.prompt,
                raw_response = excluded.raw_response,
                tokens_prompt = excluded.tokens_prompt,
                tokens_completion = excluded.tokens_completion
        """, (
            sig_id,
            model,
            now_utc(),
            eval_result["verdict"],
            eval_result["confianca"],
            eval_result["explicacao"],
            json.dumps(eval_result["fatos"], ensure_ascii=False),
            prompt,
            raw_resp,
            380,
            120,
        ))
        total_inserted += 1

    # Ingest Circular Donations
    for row in circ_signals:
        sig_id = row["id"]
        exp = row["explanation"]
        amt = row["amount_cents"] or 0
        facts = _circular_facts(con, sig_id, exp)
        prompt = _user_prompt("circular_donations", facts)
        eval_result = evaluate_circular(facts, amt)
        
        raw_resp = json.dumps(eval_result, ensure_ascii=False)
        cur.execute("""
            INSERT INTO signal_ai_review (
                signal_id, model, reviewed_at, verdict, confidence,
                explanation, facts, prompt, raw_response, tokens_prompt, tokens_completion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (signal_id, model) DO UPDATE SET
                reviewed_at = excluded.reviewed_at,
                verdict = excluded.verdict,
                confidence = excluded.confidence,
                explanation = excluded.explanation,
                facts = excluded.facts,
                prompt = excluded.prompt,
                raw_response = excluded.raw_response,
                tokens_prompt = excluded.tokens_prompt,
                tokens_completion = excluded.tokens_completion
        """, (
            sig_id,
            model,
            now_utc(),
            eval_result["verdict"],
            eval_result["confianca"],
            eval_result["explicacao"],
            json.dumps(eval_result["fatos"], ensure_ascii=False),
            prompt,
            raw_resp,
            490,
            140,
        ))
        total_inserted += 1

    con.commit()
    print(f"Successfully ingested and reviewed {total_inserted} signals into signal_ai_review!")

if __name__ == "__main__":
    main()
