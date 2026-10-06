import Link from "next/link";
import {
  getLocalCandidates,
  getLocalSignals,
  getLocalStats,
  getLocalAvailableOffices,
  getLocalAvailableYears,
  getAcreDiscoursePosts,
  getLocalSocialMediaDirectory,
  getLocalSocialPlatformCounts,
} from "@/lib/queries";
import { formatBRL } from "@/lib/format";
import { PageHeader } from "@/components/shell/shell-context";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchAvatar } from "@/components/search-avatar";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type PageSearchParams = {
  local?: string;
  ano?: string;
  cargo?: string;
  aba?: string;
  page?: string;
  plataforma?: string;
  modo_rede?: string;
};

export default async function AcrePage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const sp = await searchParams;

  const isStateWide = sp.local === "acre";
  const municipality = isStateWide ? undefined : "RIO BRANCO";
  const state = "AC";

  const availableYears = getLocalAvailableYears(state, municipality);
  const anoParam = sp.ano ? Number(sp.ano) : NaN;
  const year = Number.isInteger(anoParam) && availableYears.includes(anoParam)
    ? anoParam
    : (isStateWide ? 2024 : 2024);

  const availableOffices = getLocalAvailableOffices(state, municipality, year);
  const cargoParam = sp.cargo ?? "TODOS";
  const office = cargoParam !== "TODOS" && availableOffices.includes(cargoParam)
    ? cargoParam
    : undefined;

  const aba =
    sp.aba === "despesas" || sp.aba === "doacoes" || sp.aba === "discurso" || sp.aba === "redes"
      ? (sp.aba === "discurso" ? "redes" : sp.aba)
      : "candidatos";
  const page = Math.max(1, Number(sp.page) || 1);
  const plataforma = sp.plataforma ?? "all";
  const modoRede = sp.modo_rede === "ia_x" ? "ia_x" : "diretorio";

  // Stats for the active locality
  const stats = getLocalStats(state, municipality, year);

  const hrefFor = (updates: Partial<PageSearchParams>) => {
    const usp = new URLSearchParams();
    const merged: PageSearchParams = {
      local: sp.local,
      ano: sp.ano,
      cargo: sp.cargo,
      aba: sp.aba,
      page: sp.page,
      plataforma: sp.plataforma,
      modo_rede: sp.modo_rede,
      ...updates,
    };
    if (merged.local && merged.local !== "rio-branco") usp.set("local", merged.local);
    if (merged.ano && merged.ano !== "2024") usp.set("ano", merged.ano);
    if (merged.cargo && merged.cargo !== "TODOS") usp.set("cargo", merged.cargo);
    if (merged.aba && merged.aba !== "candidatos") usp.set("aba", merged.aba);
    if (merged.plataforma && merged.plataforma !== "all") usp.set("plataforma", merged.plataforma);
    if (merged.modo_rede && merged.modo_rede !== "diretorio") usp.set("modo_rede", merged.modo_rede);
    if (merged.page && merged.page !== "1") usp.set("page", merged.page);
    const qs = usp.toString();
    return `/acre${qs ? `?${qs}` : ""}`;
  };

  const titlePrefix = isStateWide ? "Acre (Todo o Estado)" : "Rio Branco (AC)";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        group="Localidade"
        current={isStateWide ? "Acre" : "Rio Branco"}
        actions={
          <div className="flex items-center gap-1.5">
            <Link
              href={hrefFor({ local: "rio-branco", page: "1" })}
              className={`btn btn--sm${!isStateWide ? " btn--primary" : ""}`}
            >
              📍 Rio Branco
            </Link>
            <Link
              href={hrefFor({ local: "acre", page: "1" })}
              className={`btn btn--sm${isStateWide ? " btn--primary" : ""}`}
            >
              📍 Acre (Estado)
            </Link>
          </div>
        }
      />

      {/* Header & Main Locality Switcher */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mono-label mb-2">Painel de Investigação Regional</div>
            <h1 className="text-[26px] leading-tight font-medium tracking-tight">
              {titlePrefix} — Eleições, Financiamento e Alertas
            </h1>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--muted)]">
              Cruzamento oficial de candidaturas, bens declarados, prestação de contas do TSE e sinais
              de movimentação atípica em {isStateWide ? "todos os municípios do Acre" : "Rio Branco (AC)"}.
            </p>
          </div>

          {/* Quick Locality Buttons */}
          <div className="card p-3 flex items-center gap-2">
            <span className="mono text-[11px] text-[var(--muted-2)] uppercase mr-1">Filtrar por:</span>
            <Link
              href={hrefFor({ local: "rio-branco", page: "1" })}
              className={`btn${!isStateWide ? " btn--primary font-semibold" : ""}`}
            >
              📍 Rio Branco
            </Link>
            <Link
              href={hrefFor({ local: "acre", page: "1" })}
              className={`btn${isStateWide ? " btn--primary font-semibold" : ""}`}
            >
              📍 Acre Inteiro
            </Link>
          </div>
        </div>

        {/* Secondary Filters: Year and Office */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-1)]">
          <span className="mono text-[11px] text-[var(--muted-2)] mr-1">Ano:</span>
          {availableYears.map((y) => (
            <Link
              key={y}
              href={hrefFor({ ano: String(y), page: "1" })}
              className={`btn btn--sm${year === y ? " btn--primary" : ""}`}
            >
              {y}
            </Link>
          ))}

          {availableOffices.length > 0 && (
            <>
              <span className="mono text-[11px] text-[var(--muted-2)] ml-3 mr-1">Cargo:</span>
              <Link
                href={hrefFor({ cargo: "TODOS", page: "1" })}
                className={`btn btn--sm${!office ? " btn--primary" : ""}`}
              >
                Todos
              </Link>
              {availableOffices.map((off) => (
                <Link
                  key={off}
                  href={hrefFor({ cargo: off, page: "1" })}
                  className={`btn btn--sm${office === off ? " btn--primary" : ""}`}
                >
                  {off}
                </Link>
              ))}
            </>
          )}
        </div>
      </section>

      {/* KPI Cards */}
      <section className="kpis">
        <div className="kpi">
          <div className="kpi__label">pessoas</div>
          <div className="kpi__value">{stats.people.toLocaleString("pt-BR")}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">candidaturas ({year})</div>
          <div className="kpi__value">{stats.candidacies.toLocaleString("pt-BR")}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">bens declarados</div>
          <div className="kpi__value">{formatBRL(stats.assetsTotalCents)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">doações recebidas</div>
          <div className="kpi__value kpi__value--green">{formatBRL(stats.donationsTotalCents)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">despesas contratadas</div>
          <div className="kpi__value">{formatBRL(stats.expensesTotalCents)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">alertas detectados</div>
          <div className="kpi__value text-elo-amber flex items-baseline gap-1.5">
            <span>{stats.signalsCount}</span>
            {stats.signalsAiReviewedCount > 0 && (
              <span className="mono text-[11px] font-normal text-[var(--muted)]">
                ({stats.signalsAiReviewedCount} IA)
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Tabs navigation */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-1)] pb-3">
          <Link
            href={hrefFor({ aba: "candidatos", page: "1" })}
            className={`btn${aba === "candidatos" ? " btn--primary" : ""}`}
          >
            Candidatos & Bens ({stats.candidacies})
          </Link>
          <Link
            href={hrefFor({ aba: "despesas", page: "1" })}
            className={`btn${aba === "despesas" ? " btn--primary" : ""}`}
          >
            Despesas Desproporcionais (Alertas)
          </Link>
          <Link
            href={hrefFor({ aba: "doacoes", page: "1" })}
            className={`btn${aba === "doacoes" ? " btn--primary" : ""}`}
          >
            Doações Circulares (Alertas)
          </Link>
          <Link
            href={hrefFor({ aba: "redes", page: "1" })}
            className={`btn${aba === "redes" ? " btn--primary" : ""}`}
          >
            Redes Sociais & Discurso (Instagram, Facebook, X)
          </Link>
          <Link
            href={`/sinais/analise-ia?local=${isStateWide ? "acre" : "rio-branco"}`}
            className="btn hover:border-[var(--accent-2)]"
            title="Ver triagem de IA completa para esta localidade"
          >
            🤖 Triagem da IA ({stats.signalsAiReviewedCount}) ↗
          </Link>
        </div>

        {/* Tab 1: Candidatos */}
        {aba === "candidatos" && (
          <CandidatesView
            state={state}
            municipality={municipality}
            year={year}
            office={office}
            page={page}
            hrefFor={hrefFor}
          />
        )}

        {/* Tab 2: Despesas Desproporcionais */}
        {aba === "despesas" && (
          <SignalsView
            state={state}
            municipality={municipality}
            type="cheap_item_high_value"
            title="Sinais de Despesas Desproporcionais em Itens Baratos"
            subtitle="Itens de baixo custo (adesivos, canetas, etc.) com valores muito acima da mediana"
            page={page}
            hrefFor={hrefFor}
          />
        )}

        {/* Tab 3: Doações Circulares */}
        {aba === "doacoes" && (
          <SignalsView
            state={state}
            municipality={municipality}
            type="circular_donation"
            title="Sinais de Doações Circulares (Ciclos de Recursos)"
            subtitle="Loops entre campanhas e fornecedores detectados pelo algoritmo do grafo"
            page={page}
            hrefFor={hrefFor}
          />
        )}

        {/* Tab 4: Redes Sociais & Discurso */}
        {aba === "redes" && (
          <SocialMediaAndDiscourseView
            state={state}
            municipality={municipality}
            year={year}
            office={office}
            plataforma={plataforma}
            modoRede={modoRede}
            page={page}
            hrefFor={hrefFor}
          />
        )}
      </section>
    </div>
  );
}

function CandidatesView({
  state,
  municipality,
  year,
  office,
  page,
  hrefFor,
}: {
  state: string;
  municipality?: string;
  year?: number;
  office?: string;
  page: number;
  hrefFor: (updates: Partial<PageSearchParams>) => string;
}) {
  const { total, rows } = getLocalCandidates({
    state,
    municipality,
    year,
    office,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (rows.length === 0) {
    return <EmptyState icon="◌" title="Nenhum candidato encontrado para os filtros selecionados." />;
  }

  // Top asset highlight
  const topAssets = rows.filter((r) => r.assetsCents > 0).slice(0, 5);
  const maxAsset = topAssets[0]?.assetsCents || 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Assets Visual Bar */}
      {page === 1 && topAssets.length > 0 && (
        <div className="card p-5">
          <div className="label mb-3">Maiores Patrimônios Declarados ({year})</div>
          <div className="flex flex-col gap-3">
            {topAssets.map((c) => {
              const pct = Math.max(5, Math.round((c.assetsCents / maxAsset) * 100));
              return (
                <div key={c.candidacyId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[13px]">
                    <Link href={`/politico/${c.personId}`} className="font-medium hover:underline">
                      {c.ballotName ?? c.name} ({c.partyAbbr ?? "—"}) · <span className="text-[var(--muted-2)]">{c.office}</span>
                    </Link>
                    <span className="mono font-semibold">{formatBRL(c.assetsCents)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[var(--border-1)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent-2)] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>Candidato</th>
                <th>Cargo / Município</th>
                <th>Partido</th>
                <th>Resultado</th>
                <th className="text-right">Bens Declarados</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.candidacyId}>
                  <td className="num" style={{ color: "var(--muted-2)" }}>
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <SearchAvatar photoUrl={r.photoUrl} name={r.ballotName ?? r.name} />
                      <div>
                        <Link href={`/politico/${r.personId}`} className="font-medium hover:underline">
                          {r.ballotName ?? r.name}
                        </Link>
                        {r.ballotName && r.ballotName !== r.name && (
                          <div className="text-[11px] text-[var(--muted-2)]">{r.name}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="font-medium">{r.office ?? "—"}</span>
                    <div className="mono text-[10px] text-[var(--muted-2)]">
                      {r.municipality ? `${r.municipality}/${r.state}` : r.state}
                    </div>
                  </td>
                  <td>
                    <span className="mono text-[12px]">{r.partyAbbr ?? "—"}</span>
                  </td>
                  <td>
                    {r.result ? (
                      <span
                        className={`badge ${
                          r.result.includes("ELEITO")
                            ? "badge--green"
                            : r.result.includes("SUPLENTE")
                            ? "badge--accent"
                            : ""
                        }`}
                      >
                        {r.result}
                      </span>
                    ) : (
                      <span className="text-[var(--muted-2)]">—</span>
                    )}
                  </td>
                  <td className="num font-semibold">
                    {r.assetsCents > 0 ? formatBRL(r.assetsCents) : <span className="text-[var(--muted-2)] font-normal">R$ 0,00</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="table-footer">
            <PaginationLinks
              page={page}
              totalPages={totalPages}
              makeHref={(p) => hrefFor({ page: String(p) })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SignalsView({
  state,
  municipality,
  type,
  title,
  subtitle,
  page,
  hrefFor,
}: {
  state: string;
  municipality?: string;
  type: string;
  title: string;
  subtitle: string;
  page: number;
  hrefFor: (updates: Partial<PageSearchParams>) => string;
}) {
  const { total, rows } = getLocalSignals({
    state,
    municipality,
    type,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (rows.length === 0) {
    return <EmptyState icon="◌" title="Nenhum alerta registrado nesta localidade." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[18px] font-medium tracking-tight">{title}</h2>
        <p className="text-[13px] text-[var(--muted)]">{subtitle}</p>
      </div>

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="table min-w-[800px]">
            <thead>
              <tr>
                <th style={{ width: 85 }}>Severidade</th>
                <th style={{ width: 120 }}>Triagem IA</th>
                <th>Candidato Envolvido</th>
                <th>Cargo / Localidade</th>
                <th className="text-right">Valor</th>
                <th>Detalhes do Sinal & Análise de IA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span
                      className={`badge ${
                        s.severity === "high"
                          ? "badge--red"
                          : s.severity === "medium"
                          ? "badge--accent"
                          : ""
                      }`}
                    >
                      {s.severity === "high" ? "Alta" : s.severity === "medium" ? "Média" : "Baixa"}
                    </span>
                  </td>
                  <td>
                    {s.aiVerdict ? (
                      <span
                        className={`badge ${
                          s.aiVerdict === "bizarro"
                            ? "badge--red font-semibold"
                            : s.aiVerdict === "inconclusivo"
                            ? "badge--accent font-medium"
                            : "font-medium"
                        }`}
                        title={s.aiConfidence ? `Confiança: ${s.aiConfidence}` : undefined}
                      >
                        {s.aiVerdict === "bizarro"
                          ? "🚨 Bizarro"
                          : s.aiVerdict === "plausivel"
                          ? "✅ Plausível"
                          : "⚠️ Inconclusivo"}
                      </span>
                    ) : (
                      <span className="mono text-[11px] text-[var(--muted-2)]">Pendente</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <SearchAvatar photoUrl={s.photoUrl} name={s.personName} />
                      <Link href={`/politico/${s.personId}`} className="font-medium hover:underline">
                        {s.personName}
                      </Link>
                    </div>
                  </td>
                  <td>
                    <div className="text-[13px]">{s.office ?? "—"}</div>
                    <div className="mono text-[10px] text-[var(--muted-2)]">
                      {s.municipality ? `${s.municipality}/${s.state}` : s.state} · {s.year}
                    </div>
                  </td>
                  <td className="num font-semibold">
                    {s.amountCents ? formatBRL(s.amountCents) : "—"}
                  </td>
                  <td className="text-[12.5px] max-w-md leading-relaxed text-[var(--muted)]">
                    <div>{s.explanation}</div>
                    {s.aiExplanation && (
                      <div className="mt-2.5 rounded-[var(--r-card)] border border-[var(--border-1)] bg-[var(--bg-1)] p-2.5 text-[12px] text-[var(--fg-1)]">
                        <div className="flex items-center gap-1.5 font-medium text-[var(--fg-2)] mb-1">
                          <span>🤖 Parecer da IA (DeepSeek):</span>
                          {s.aiConfidence && (
                            <span className="mono text-[10px] text-[var(--muted)] uppercase">
                              ({s.aiConfidence})
                            </span>
                          )}
                        </div>
                        <p className="text-[var(--muted)] leading-relaxed">{s.aiExplanation}</p>
                        {s.aiFacts && s.aiFacts.length > 0 && (
                          <ul className="mt-1.5 flex flex-col gap-0.5 text-[11px] text-[var(--muted-2)]">
                            {s.aiFacts.map((f, idx) => (
                              <li key={idx} className="flex gap-1.5">
                                <span>•</span>
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="table-footer">
            <PaginationLinks
              page={page}
              totalPages={totalPages}
              makeHref={(p) => hrefFor({ page: String(p) })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function cleanSocialLink(platform: string, rawUrl: string) {
  const url = (rawUrl || "").trim().replace(/\\/g, "/");
  if (!url) return { href: "#", label: "Link indisponível", icon: "🔗" };

  let href = url;
  let icon = "🔗";
  const plat = platform.toLowerCase();

  if (plat === "instagram" || url.includes("instagram.com")) {
    icon = "📷";
  } else if (plat === "facebook" || url.includes("facebook.com")) {
    icon = "📘";
  } else if (plat === "tiktok" || url.includes("tiktok.com")) {
    icon = "🎵";
  } else if (plat === "x" || plat === "twitter" || url.includes("twitter.com") || url.includes("x.com")) {
    icon = "🐦";
  } else if (plat === "youtube" || url.includes("youtube.com") || url.includes("youtu.be")) {
    icon = "▶️";
  } else if (plat === "website" || url.includes("http")) {
    icon = "🌐";
  } else if (plat === "whatsapp" || url.includes("wa.me")) {
    icon = "💬";
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    href = url;
  } else if (url.startsWith("www.") || url.includes(".com") || url.includes(".net") || url.includes(".br")) {
    href = `https://${url.replace(/^\/+/, "")}`;
  } else if (url.startsWith("@")) {
    const handle = url.slice(1);
    if (plat === "instagram" || plat === "other") {
      href = `https://www.instagram.com/${handle}`;
      if (plat === "other") icon = "📷";
    } else if (plat === "tiktok") {
      href = `https://www.tiktok.com/@${handle}`;
    } else if (plat === "x" || plat === "twitter") {
      href = `https://x.com/${handle}`;
    } else {
      href = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }
  } else if (url.includes("@") && url.includes(".")) {
    href = `mailto:${url}`;
  } else {
    href = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
  }

  let label = url;
  const mInsta = url.match(/instagram\.com\/([a-zA-Z0-9_\.]+)/i);
  if (mInsta && mInsta[1]) {
    label = `@${mInsta[1].split(/[/?]/)[0]}`;
  } else {
    const mTik = url.match(/tiktok\.com\/@([a-zA-Z0-9_\.]+)/i);
    if (mTik && mTik[1]) {
      label = `@${mTik[1].split(/[/?]/)[0]}`;
    } else {
      const mX = url.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i);
      if (mX && mX[1]) {
        label = `@${mX[1].split(/[/?]/)[0]}`;
      } else if (url.includes("facebook.com")) {
        label = "Facebook";
      } else if (url.length > 30) {
        label = url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 26) + "...";
      }
    }
  }

  return { href, label, icon };
}

function SocialMediaAndDiscourseView({
  state,
  municipality,
  year,
  office,
  plataforma,
  modoRede,
  page,
  hrefFor,
}: {
  state: string;
  municipality?: string;
  year?: number;
  office?: string;
  plataforma: string;
  modoRede: "diretorio" | "ia_x";
  page: number;
  hrefFor: (updates: Partial<PageSearchParams>) => string;
}) {
  const platformCounts = getLocalSocialPlatformCounts({ state, municipality, year });
  const totalAccounts = platformCounts.reduce((acc, c) => acc + c.count, 0);

  const instaCount = platformCounts.find((c) => c.platform === "instagram")?.count || 0;
  const faceCount = platformCounts.find((c) => c.platform === "facebook")?.count || 0;
  const tikCount = platformCounts.find((c) => c.platform === "tiktok")?.count || 0;
  const xCount = platformCounts.find((c) => c.platform === "x")?.count || 0;
  const ytCount = platformCounts.find((c) => c.platform === "youtube")?.count || 0;
  const webCount = platformCounts.find((c) => c.platform === "website")?.count || 0;

  // Total discourse posts available on X
  const discourseSummary = getAcreDiscoursePosts({ municipality, limit: 1 });
  const discourseTotal = discourseSummary.total;

  // Directory query
  const directoryData = getLocalSocialMediaDirectory({
    state,
    municipality,
    year,
    office,
    platform: plataforma,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  // Discourse query (if in ia_x mode)
  const discourseData =
    modoRede === "ia_x"
      ? getAcreDiscoursePosts({
          municipality,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        })
      : null;

  const currentTotal = modoRede === "diretorio" ? directoryData.total : (discourseData?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(currentTotal / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      {/* Acre Digital Reality Insight Card */}
      <div className="card p-5 border-[var(--border-1)] bg-[var(--bg-1)]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[17px]">💡</span>
            <h3 className="font-semibold text-[15px] text-[var(--fg-1)]">
              Realidade Regional do Acre: Domínio Esmagador de Instagram e Facebook
            </h3>
          </div>
          <p className="text-[13.5px] leading-relaxed text-[var(--muted)]">
            Diferente dos estados do Sul e Sudeste onde o X (Twitter) possui forte engajamento partidário,
            a campanha e o discurso político no Acre ocorrem quase exclusivamente no{" "}
            <strong className="text-[var(--fg-1)]">Instagram</strong> e no{" "}
            <strong className="text-[var(--fg-1)]">Facebook</strong>, com ascensão do{" "}
            <strong className="text-[var(--fg-1)]">TikTok</strong>. O X representa{" "}
            <strong className="text-[var(--fg-1)]">menos de 2%</strong> do total de redes declaradas ao TSE no estado.
          </p>
          <div className="rounded-[var(--r-card)] border border-[var(--border-1)] bg-[var(--bg-2)] p-3 text-[12.5px] text-[var(--muted)] leading-relaxed">
            <span className="font-semibold text-[var(--fg-2)]">Por que o modelo de IA do EloSys avaliou posts no X?</span> As
            plataformas da Meta (Instagram/Facebook) são ecossistemas fechados (&ldquo;walled gardens&rdquo;) que bloqueiam raspagem automatizada
            e são centradas em imagens e Reels/vídeos. O EloSys focou sua análise de linguagem natural e triagem com IA (DeepSeek)
            nas contas do X, mas <strong>mapeou todo o diretório oficial de contas da Meta declarado pelos candidatos</strong> para que você possa consultar e verificar cada perfil diretamente.
          </div>
        </div>
      </div>

      {/* Locality Platform Counters Bar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono text-[11px] text-[var(--muted-2)] uppercase mr-1">
            Contas Oficiais Declaradas ao TSE ({municipality ? "Rio Branco" : "Acre"}):
          </span>
          <span className="badge badge--accent font-medium">📷 Instagram: {instaCount}</span>
          <span className="badge font-medium">📘 Facebook: {faceCount}</span>
          <span className="badge font-medium">🎵 TikTok: {tikCount}</span>
          <span className="badge font-medium">🐦 X / Twitter: {xCount}</span>
          {ytCount > 0 && <span className="badge font-medium">▶️ YouTube: {ytCount}</span>}
          {webCount > 0 && <span className="badge font-medium">🌐 Sites: {webCount}</span>}
        </div>
        <div className="mono text-[12px] text-[var(--muted-2)]">
          Total de links mapeados: <strong className="text-[var(--fg-1)]">{totalAccounts}</strong>
        </div>
      </div>

      {/* Sub-mode Switcher: Directory vs AI Discourse on X */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-1)] pb-3">
        <div className="flex items-center gap-2">
          <Link
            href={hrefFor({ modo_rede: "diretorio", page: "1" })}
            className={`btn btn--sm${modoRede === "diretorio" ? " btn--primary font-semibold" : ""}`}
          >
            📱 Diretório Oficial de Perfis ({directoryData.total} candidatos)
          </Link>
          <Link
            href={hrefFor({ modo_rede: "ia_x", page: "1" })}
            className={`btn btn--sm${modoRede === "ia_x" ? " btn--primary font-semibold" : ""}`}
          >
            🤖 Posts Triados com IA no X ({discourseTotal} avaliações)
          </Link>
        </div>

        {modoRede === "diretorio" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mono text-[11px] text-[var(--muted-2)] mr-1">Filtrar rede:</span>
            <Link
              href={hrefFor({ plataforma: "all", page: "1" })}
              className={`btn btn--sm${plataforma === "all" ? " btn--primary" : ""}`}
            >
              Todas
            </Link>
            <Link
              href={hrefFor({ plataforma: "instagram", page: "1" })}
              className={`btn btn--sm${plataforma === "instagram" ? " btn--primary" : ""}`}
            >
              📷 Instagram ({instaCount})
            </Link>
            <Link
              href={hrefFor({ plataforma: "facebook", page: "1" })}
              className={`btn btn--sm${plataforma === "facebook" ? " btn--primary" : ""}`}
            >
              📘 Facebook ({faceCount})
            </Link>
            {tikCount > 0 && (
              <Link
                href={hrefFor({ plataforma: "tiktok", page: "1" })}
                className={`btn btn--sm${plataforma === "tiktok" ? " btn--primary" : ""}`}
              >
                🎵 TikTok ({tikCount})
              </Link>
            )}
            {xCount > 0 && (
              <Link
                href={hrefFor({ plataforma: "x", page: "1" })}
                className={`btn btn--sm${plataforma === "x" ? " btn--primary" : ""}`}
              >
                🐦 X ({xCount})
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Mode 1: Directory View */}
      {modoRede === "diretorio" && (
        <div className="flex flex-col gap-4">
          {directoryData.rows.length === 0 ? (
            <EmptyState
              icon="◌"
              title="Nenhum candidato encontrado com rede social para os filtros selecionados."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {directoryData.rows.map((c) => (
                <div
                  key={`${c.personId}-${c.year}`}
                  className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-[var(--border-2)]"
                >
                  <div className="flex items-center gap-3.5">
                    <SearchAvatar photoUrl={c.photoUrl} name={c.ballotName} />
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/politico/${c.personId}`}
                          className="font-semibold text-[14.5px] hover:underline"
                        >
                          {c.ballotName}
                        </Link>
                        {c.partyAbbr && <span className="badge">{c.partyAbbr}</span>}
                        <span className="mono text-[11px] text-[var(--muted-2)]">{c.year}</span>
                      </div>
                      <div className="text-[12.5px] text-[var(--muted)]">
                        {c.fullName !== c.ballotName && c.fullName ? `${c.fullName} · ` : ""}
                        <span className="font-medium text-[var(--fg-2)]">{c.office ?? "Candidato"}</span>
                        {c.municipality ? ` em ${c.municipality}` : ""}
                      </div>
                    </div>
                  </div>

                  {/* Declared accounts buttons */}
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {c.accounts.map((acc, idx) => {
                      const { href, label, icon } = cleanSocialLink(acc.platform, acc.url);
                      const isInsta = acc.platform === "instagram";
                      const isFace = acc.platform === "facebook";
                      return (
                        <a
                          key={idx}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`badge flex items-center gap-1.5 py-1 px-2.5 text-[12px] hover:border-[var(--accent-2)] transition-colors ${
                            isInsta ? "badge--accent" : isFace ? "border-[var(--border-2)]" : ""
                          }`}
                          title={acc.url}
                        >
                          <span>{icon}</span>
                          <span className="max-w-[150px] truncate">{label}</span>
                          <span className="text-[10px] opacity-70">↗</span>
                        </a>
                      );
                    })}
                    <Link
                      href={`/politico/${c.personId}`}
                      className="btn btn--sm text-[11px] ml-1"
                      title="Ver ficha completa no EloSys"
                    >
                      Ficha ↗
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mode 2: AI Discourse on X */}
      {modoRede === "ia_x" && discourseData && (
        <div className="flex flex-col gap-4">
          {discourseData.rows.length === 0 ? (
            <EmptyState
              icon="◌"
              title="Nenhum post no X registrado para os filtros selecionados."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {discourseData.rows.map((p) => (
                <div
                  key={p.id}
                  className={`card p-5 flex flex-col gap-3 transition-colors ${
                    p.isOffensive ? "border-[var(--accent-2)] bg-[var(--bg-2)]" : ""
                  }`}
                >
                  {/* Header: Author & Metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[14px]">{p.personName}</span>
                          <a
                            href={`https://x.com/${p.handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mono text-[12px] text-[var(--muted)] hover:underline"
                          >
                            @{p.handle}
                          </a>
                        </div>
                        <div className="mono text-[11px] text-[var(--muted-2)]">
                          {p.office ?? "Político"} · {p.municipality ?? "Acre"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {p.isOffensive ? (
                        <span className="badge badge--red">
                          Ofensivo ({p.severity === "high" ? "Alta Severidade" : "Média"})
                        </span>
                      ) : p.explanation ? (
                        <span className="badge">Revisado (Uso Legítimo / Neutro)</span>
                      ) : (
                        <span className="badge">Post Coletado</span>
                      )}
                      {p.postedAt && (
                        <span className="mono text-[11px] text-[var(--muted-2)]">
                          {p.postedAt.slice(4, 16)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Post text */}
                  <p className="text-[14px] leading-relaxed whitespace-pre-line text-[var(--fg-1)]">
                    {p.text}
                  </p>

                  {/* AI Review Explanation if exists */}
                  {p.explanation && (
                    <div className="rounded-[var(--r-card)] border border-[var(--border-1)] bg-[var(--bg-1)] p-3 text-[12.5px] leading-relaxed">
                      <div className="flex items-center gap-1.5 font-medium text-[var(--fg-2)] mb-1">
                        <span>🤖 Análise da IA (DeepSeek):</span>
                        {p.quote && (
                          <span className="mono text-[11px] text-[var(--muted)]">
                            termo destacado: <strong>&ldquo;{p.quote}&rdquo;</strong>
                          </span>
                        )}
                      </div>
                      <div className="text-[var(--muted)]">{p.explanation}</div>
                    </div>
                  )}

                  {/* Footer with stats and link */}
                  <div className="flex items-center justify-between text-[11.5px] text-[var(--muted-2)] pt-1 border-t border-[var(--border-1)]">
                    <div className="flex items-center gap-4 mono">
                      <span>♡ {p.likeCount ?? 0}</span>
                      <span>↻ {p.repostCount ?? 0}</span>
                    </div>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline flex items-center gap-1 text-[var(--muted)] hover:text-[var(--fg-1)]"
                      >
                        Ver no X ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="table-footer">
          <PaginationLinks
            page={page}
            totalPages={totalPages}
            makeHref={(p) => hrefFor({ page: String(p) })}
          />
        </div>
      )}
    </div>
  );
}

