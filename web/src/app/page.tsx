import Link from "next/link";
import { SearchBox } from "@/components/search-box";
import { TopSuppliers } from "@/components/top-suppliers";
import { PageHeader } from "@/components/shell/shell-context";
import { YearSelect } from "@/components/ui/year-select";
import { getHomeStats } from "@/lib/stats";
import { getExpenseYears } from "@/lib/queries";
import { formatBRL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const anoParam = typeof sp.ano === "string" ? Number(sp.ano) : NaN;
  const expenseYears = getExpenseYears();
  const year = Number.isInteger(anoParam) && expenseYears.includes(anoParam) ? anoParam : undefined;

  const stats = getHomeStats(year);

  const heroStats = [
    { label: "pessoas", value: stats.people.toLocaleString("pt-BR") },
    { label: "candidaturas", value: stats.candidacies.toLocaleString("pt-BR") },
    { label: "doações recebidas", value: formatBRL(stats.donationsTotalCents), tone: "green" as const },
    { label: "despesas contratadas", value: formatBRL(stats.expensesTotalCents) },
    { label: year ? "eleição" : "período coberto", value: stats.years },
  ];

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        group="EloSys"
        current="Início"
        actions={<YearSelect basePath="/" years={expenseYears} value={year} allLabel="todos os anos" />}
      />

      <div
        className="animate-in relative overflow-hidden rounded-[var(--r-page)] border border-[var(--border-1)] px-6 py-16 sm:px-12 sm:py-20"
      >
        <div className="hero-glow" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(900px 420px at 22% 30%, #000, transparent 72%)",
          }}
        />
        <div className="relative max-w-2xl">
          <div className="mono-label mb-4">busca de dados públicos · CPF/CNPJ</div>
          <h1 className="text-[clamp(30px,5vw,48px)] leading-[1.06] font-medium tracking-tight text-balance">
            Ficha pública de <span className="text-[var(--muted)]">qualquer candidato</span> brasileiro
            <span className="text-[var(--accent-2)]">.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
            Busque por nome ou CPF. Cada campo mostra de qual arquivo do TSE ele saiu, quando foi
            baixado e o hash que comprova que não foi alterado.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <SearchBox />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="mono text-[11px] text-[var(--muted-2)]">puxar por localidade:</span>
              <Link
                href="/acre?local=rio-branco"
                className="btn btn--sm btn--primary font-medium"
                title="Puxar dados de candidatos, bens e sinais de Rio Branco (AC)"
              >
                📍 Rio Branco (AC)
              </Link>
              <Link
                href="/acre?local=acre"
                className="btn btn--sm"
                title="Puxar dados do Acre inteiro"
              >
                📍 Acre (Todo o Estado)
              </Link>
            </div>
          </div>
        </div>
      </div>

      <section className="animate-in flex flex-col gap-4" style={{ animationDelay: "80ms" }}>
        <div className="kpis">
          {heroStats.map((s) => (
            <div key={s.label} className="kpi">
              <div className="kpi__label">{s.label}</div>
              <div className={`kpi__value${s.tone === "green" ? " kpi__value--green" : ""}`}>{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="animate-in" style={{ animationDelay: "150ms" }}>
        <TopSuppliers years={expenseYears} initialYear={year} />
      </div>

      <div className="card animate-in max-w-2xl" style={{ animationDelay: "220ms" }}>
        <div className="label mb-3">indício não é prova</div>
        <p className="text-[13.5px] leading-relaxed text-[var(--muted)]">
          O EloSys reúne dados que já são públicos por lei (registro de candidatura do TSE,
          prestação de contas eleitorais, redes sociais declaradas) e os organiza por pessoa. Nada
          aqui é acusação — é o dado bruto oficial, com a fonte exposta em cada campo, para que
          qualquer um confira e vá além se quiser apurar.
        </p>
      </div>
    </div>
  );
}
