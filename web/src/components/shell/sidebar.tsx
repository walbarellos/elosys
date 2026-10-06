"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SidebarCounts } from "@/lib/stats";
import { useShell } from "./shell-context";

type NavLink = { href: string; label: string; count?: number; alert?: boolean };

export function Sidebar({ counts }: { counts: SidebarCounts }) {
  const pathname = usePathname();
  const { setPaletteOpen } = useShell();

  const top: NavLink[] = [
    { href: "/", label: "Início" },
    { href: "/acre", label: "📍 Acre / Rio Branco" },
    { href: "/grafo", label: "Grafo de correlações" },
    { href: "/ranking", label: "Bens declarados" },
    { href: "/emendas", label: "Emendas parlamentares" },
  ];
  const sinais: NavLink[] = [
    { href: "/sinais/doacao-circular", label: "Doação circular", count: counts.circularDonations, alert: true },
    { href: "/sinais/despesa-desproporcional", label: "Despesa desproporcional", count: counts.disproportionateExpense },
    { href: "/sinais/socio-fornecedor", label: "Sócio de fornecedor", count: counts.supplierPartner },
    { href: "/sinais/analise-ia", label: "Análise de IA", count: counts.aiReview },
    { href: "/sinais/discurso", label: "Discurso em rede social", count: counts.discourse, alert: true },
  ];

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__top">
        <Link href="/" className="app-sidebar__logo">
          <span className="navbar__mark">E</span>
          <span className="navbar__name">EloSys</span>
        </Link>
        <button
          type="button"
          className="btn btn--icon"
          onClick={() => setPaletteOpen(true)}
          aria-label="Buscar"
          title="Buscar (Ctrl K)"
        >
          ⌕
        </button>
      </div>

      <nav className="app-sidebar__nav" aria-label="navegação principal">
        <div className="navmenu__items">
          {top.map((l) => (
            <Link key={l.href} href={l.href} className={`navitem${pathname === l.href ? " is-active" : ""}`}>
              {l.label}
            </Link>
          ))}
        </div>
        <NavGroup title="Sinais" links={sinais} pathname={pathname} />
      </nav>
    </aside>
  );
}

function NavGroup({ title, links, pathname }: { title: string; links: NavLink[]; pathname: string }) {
  return (
    <div className="app-sidebar__group">
      <div className="label">{title}</div>
      <div className="navmenu__items">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`navitem${pathname === l.href ? " is-active" : ""}`}>
            {l.label}
            {l.count != null ? (
              <span className={`navitem__count${l.alert && l.count > 0 ? " navitem__count--alert" : ""}`}>
                {l.count.toLocaleString("pt-BR")}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
