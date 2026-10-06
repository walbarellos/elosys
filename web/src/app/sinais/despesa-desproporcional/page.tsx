import Link from "next/link";
import {
  getExpenseCategoryRanking,
  getExpenseYears,
  EXPENSE_CATEGORIES,
} from "@/lib/queries";
import { expenseCategoryLabel } from "@/lib/format";
import { PageHeader } from "@/components/shell/shell-context";
import { YearSelect } from "@/components/ui/year-select";
import { ExpenseCategorySelect } from "@/components/ui/expense-category-select";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryExpenseRow } from "@/components/category-expense-row";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;
const ALL = "TODAS";

export default async function DespesaDesproporcionalPage({
  searchParams,
}: PageProps<"/sinais/despesa-desproporcional">) {
  const sp = await searchParams;
  const years = getExpenseYears();

  const localParam = typeof sp.local === "string" ? sp.local : "";
  const isAcre = localParam === "acre" || localParam === "rio-branco";
  const state = isAcre ? "AC" : undefined;

  const categoryParam = typeof sp.categoria === "string" ? sp.categoria : undefined;
  const category =
    categoryParam != null && EXPENSE_CATEGORIES.includes(categoryParam) ? categoryParam : undefined;
  const categoryLabel = category ? expenseCategoryLabel(category).toLowerCase() : "itens baratos (todas as categorias)";

  const yearParam = typeof sp.ano === "string" ? sp.ano : undefined;
  const year =
    yearParam === ALL ? undefined
    : years.includes(Number(yearParam)) ? Number(yearParam)
    : years[0];
  const yearLabel = year ?? "todos os anos";

  const page = Math.max(1, Number(sp.page) || 1);

  const { rows, total } = years.length > 0
    ? getExpenseCategoryRanking({ category, year, state, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
    : { rows: [], total: 0 };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hrefFor = (p: Record<string, string | undefined>) => {
    const usp = new URLSearchParams();
    if (p.categoria && p.categoria !== ALL) usp.set("categoria", p.categoria);
    const loc = p.local !== undefined ? p.local : localParam;
    if (loc) usp.set("local", loc);
    if (p.ano) usp.set("ano", p.ano);
    if (p.page && p.page !== "1") usp.set("page", p.page);
    const s = usp.toString();
    return `/sinais/despesa-desproporcional${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        group="Sinais"
        current="Despesa desproporcional"
        actions={<YearSelect basePath="/sinais/despesa-desproporcional" years={years} value={year} allLabel="todos" />}
      />

      <section>
        <h1 className="text-[26px] leading-tight font-medium tracking-tight">
          Quem mais gastou em itens baratos, por categoria
        </h1>
        <p className="mt-4 max-w-2xl text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
          Compara o gasto de cada candidato em itens baratos (canetas, adesivos, crachás…) com a{" "}
          <strong style={{ color: "var(--fg-2)" }}>mediana histórica da categoria</strong> e com a média
          de pares de <strong style={{ color: "var(--fg-2)" }}>mesmo cargo e estado</strong>. Indício de
          desproporção, não fraude confirmada.
        </p>

        <div className="mt-5">
          <ExpenseCategorySelect
            basePath="/sinais/despesa-desproporcional"
            categories={EXPENSE_CATEGORIES}
            value={category}
          />
        </div>

        {/* Regional Filter Buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mono text-[11px] text-[var(--muted-2)]">Localidade:</span>
          <Link
            href={hrefFor({ local: "", page: "1" })}
            className={`btn btn--sm${!localParam ? " btn--primary" : ""}`}
          >
            Brasil (Nacional)
          </Link>
          <Link
            href={hrefFor({ local: "acre", page: "1" })}
            className={`btn btn--sm${isAcre ? " btn--primary" : ""}`}
          >
            📍 Acre / Rio Branco (AC)
          </Link>
        </div>
      </section>

      <section>
        {years.length === 0 ? (
          <EmptyState
            icon="◌"
            title="nenhuma despesa de campanha coletada ainda"
            hint={<code>elosys tse-accounts --db elosys.db</code>}
          />
        ) : rows.length === 0 ? (
          <EmptyState icon="◌" title={`ninguém gastou em ${categoryLabel} em ${yearLabel}.`} />
        ) : (
          <div className="table-wrap">
            <div className="overflow-x-auto">
              <table className="table min-w-[820px]">
                <thead>
                  <tr>
                    <th>candidato</th>
                    <th>cargo/estado</th>
                    <th className="text-right">gasto</th>
                    <th className="text-right">% receita</th>
                    <th className="text-right">média dos pares</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <CategoryExpenseRow key={r.personId} r={r} category={category} year={year} />
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div className="table-footer">
                <PaginationLinks
                  page={page}
                  totalPages={totalPages}
                  makeHref={(p) => hrefFor({ categoria: category ?? ALL, ano: year != null ? String(year) : ALL, page: String(p) })}
                />
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
