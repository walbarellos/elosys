import Link from "next/link";
import { getAiReviewCount, getAiReviews, getAiReviewSummary, type AiVerdict } from "@/lib/queries";
import { formatBRL } from "@/lib/format";
import { PageHeader } from "@/components/shell/shell-context";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const VERDICTS: AiVerdict[] = ["bizarro", "inconclusivo", "plausivel"];
const VERDICT_LABEL: Record<AiVerdict, string> = {
  bizarro: "bizarro",
  inconclusivo: "inconclusivo",
  plausivel: "plausível",
};
const VERDICT_SIGNAL_CLASS: Record<AiVerdict, string> = {
  bizarro: "signal--high",
  inconclusivo: "signal--medium",
  plausivel: "signal--low",
};
const VERDICT_BADGE: Record<AiVerdict, string> = {
  bizarro: "badge--red",
  inconclusivo: "badge--accent",
  plausivel: "",
};
const RULES = [
  { value: "circular_donations", label: "doação circular" },
  { value: "disproportionate_expense", label: "despesa desproporcional" },
];

export default async function AnaliseIaPage({ searchParams }: PageProps<"/sinais/analise-ia">) {
  const sp = await searchParams;
  const verdictParam = typeof sp.verdict === "string" ? sp.verdict : undefined;
  const verdict = VERDICTS.includes(verdictParam as AiVerdict) ? (verdictParam as AiVerdict) : undefined;
  const ruleParam = typeof sp.rule === "string" ? sp.rule : undefined;
  const rule = RULES.some((r) => r.value === ruleParam) ? ruleParam : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const localParam = typeof sp.local === "string" ? sp.local : undefined;
  const state = localParam === "acre" || localParam === "rio-branco" ? "AC" : undefined;
  const municipality = localParam === "rio-branco" ? "RIO BRANCO" : undefined;

  const summary = getAiReviewSummary({ state, municipality });
  const count = getAiReviewCount({ verdict, rule, state, municipality });
  const reviews = getAiReviews({ verdict, rule, state, municipality, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const hrefFor = (p: Record<string, string | undefined>) => {
    const usp = new URLSearchParams();
    const merged: Record<string, string | undefined> = { local: localParam, verdict, rule, ...p };
    if (merged.local) usp.set("local", merged.local);
    if (merged.verdict) usp.set("verdict", merged.verdict);
    if (merged.rule) usp.set("rule", merged.rule);
    if (merged.page && merged.page !== "1") usp.set("page", merged.page);
    const qs = usp.toString();
    return `/sinais/analise-ia${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        group="Sinais"
        current="Análise de IA"
        actions={
          <div className="flex items-center gap-1.5">
            <Link
              href={hrefFor({ local: undefined, page: "1" })}
              className={`btn btn--sm${!localParam ? " btn--primary" : ""}`}
            >
              Brasil
            </Link>
            <Link
              href={hrefFor({ local: "rio-branco", page: "1" })}
              className={`btn btn--sm${localParam === "rio-branco" ? " btn--primary" : ""}`}
            >
              📍 Rio Branco
            </Link>
            <Link
              href={hrefFor({ local: "acre", page: "1" })}
              className={`btn btn--sm${localParam === "acre" ? " btn--primary" : ""}`}
            >
              📍 Acre
            </Link>
          </div>
        }
      />

      <section>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] leading-tight font-medium tracking-tight">
              O que a IA achou estranho {localParam === "rio-branco" ? "— Rio Branco (AC)" : localParam === "acre" ? "— Acre" : ""}
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
              Cada sinal de <strong style={{ color: "var(--fg-2)" }}>doação circular</strong> ou{" "}
              <strong style={{ color: "var(--fg-2)" }}>despesa desproporcional</strong> foi passado pra um modelo
              barato (DeepSeek) com os fatos, e ele respondeu se aquilo é <em>rotineiro</em> ou{" "}
              <em>genuinamente estranho</em>. A resposta, a explicação e os fatos que o modelo citou ficam
              salvos junto do sinal.{" "}
              <strong style={{ color: "var(--fg-2)" }}>Continua sendo indício, não prova</strong> — agora com a
              opinião de uma máquina anexada, que também pode estar errada.
            </p>
          </div>

          <div className="card p-3 flex items-center gap-2">
            <span className="mono text-[11px] text-[var(--muted-2)] uppercase mr-1">Região:</span>
            <Link
              href={hrefFor({ local: undefined, page: "1" })}
              className={`btn btn--sm${!localParam ? " btn--primary font-semibold" : ""}`}
            >
              Brasil
            </Link>
            <Link
              href={hrefFor({ local: "rio-branco", page: "1" })}
              className={`btn btn--sm${localParam === "rio-branco" ? " btn--primary font-semibold" : ""}`}
            >
              📍 Rio Branco
            </Link>
            <Link
              href={hrefFor({ local: "acre", page: "1" })}
              className={`btn btn--sm${localParam === "acre" ? " btn--primary font-semibold" : ""}`}
            >
              📍 Acre
            </Link>
          </div>
        </div>

        {summary.total === 0 ? null : (
          <div className="mono mt-6 flex flex-wrap items-center gap-x-6 gap-y-2" style={{ fontSize: 11, color: "var(--muted)" }}>
            <span>
              <span style={{ color: "var(--fg-1)" }}>{summary.total.toLocaleString("pt-BR")}</span> revisados
            </span>
            {VERDICTS.map((v) =>
              summary.byVerdict[v] ? (
                <span key={v}>{summary.byVerdict[v].toLocaleString("pt-BR")} {VERDICT_LABEL[v]}</span>
              ) : null
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link href={hrefFor({ rule, page: "1" })} className={`btn${!verdict ? " btn--primary" : ""}`}>
            todos
          </Link>
          {VERDICTS.map((v) => (
            <Link key={v} href={hrefFor({ verdict: v, rule, page: "1" })} className={`btn${verdict === v ? " btn--primary" : ""}`}>
              {VERDICT_LABEL[v]}
            </Link>
          ))}
          <div className="mx-2 h-4 w-px" style={{ background: "var(--border-1)" }} />
          <Link href={hrefFor({ verdict, page: "1" })} className={`btn${!rule ? " btn--primary" : ""}`}>
            toda regra
          </Link>
          {RULES.map((rr) => (
            <Link key={rr.value} href={hrefFor({ verdict, rule: rr.value, page: "1" })} className={`btn${rule === rr.value ? " btn--primary" : ""}`}>
              {rr.label}
            </Link>
          ))}
        </div>
      </section>

      <section>
        {summary.total === 0 ? (
          <EmptyState
            icon="◌"
            title="nenhuma revisão ainda"
            hint={
              <>
                <code>elosys ai-review --db elosys.db --limit 100</code> (precisa de{" "}
                <code>DEEPSEEK_API_KEY</code>)
              </>
            }
          />
        ) : reviews.length === 0 ? (
          <EmptyState icon="◌" title="sem revisões para esse filtro." />
        ) : (
          <div className="flex flex-col gap-3">
            {reviews.map((r) => (
              <article key={r.signalId} className={`signal ${VERDICT_SIGNAL_CLASS[r.verdict]}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`badge ${VERDICT_BADGE[r.verdict]}`}>
                    IA: {VERDICT_LABEL[r.verdict]}
                    {r.confidence ? ` · confiança ${r.confidence}` : ""}
                  </span>
                  <span className="mono-label">{r.ruleLabel}</span>
                  {r.signalAmountCents > 0 ? (
                    <span className="num" style={{ marginLeft: "auto", fontSize: 17 }}>{formatBRL(r.signalAmountCents)}</span>
                  ) : null}
                </div>

                <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: "var(--fg-2)" }}>{r.explanation}</p>

                {r.facts.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-1 text-[12px]" style={{ color: "var(--muted)" }}>
                    {r.facts.map((f, i) => (
                      <li key={i} className="flex gap-2">
                        <span style={{ color: "var(--muted-2)" }}>–</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <details className="mt-3">
                  <summary className="mono-label cursor-pointer">sinal original</summary>
                  <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>{r.signalExplanation}</p>
                </details>

                {r.graphIds && r.graphIds.length > 0 ? (
                  <div className="mt-4">
                    <Link href={`/grafo?add=${encodeURIComponent(r.graphIds.join(","))}`} className="btn btn--primary">
                      Ver no grafo
                    </Link>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-8 flex items-center justify-center border-t border-[var(--border-1)] pt-4">
            <PaginationLinks
              page={page}
              totalPages={totalPages}
              makeHref={(p) => hrefFor({ verdict, rule, page: String(p) })}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
