"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/lib/queries";
import { formatCpfCnpj } from "@/lib/format";
import { SearchAvatar } from "@/components/search-avatar";
import { useShell } from "./shell-context";

const SHORTCUTS = [
  { href: "/", label: "Início" },
  { href: "/acre", label: "📍 Acre · Rio Branco" },
  { href: "/grafo", label: "Grafo de correlações" },
  { href: "/sinais/doacao-circular", label: "Sinais · Doação circular" },
  { href: "/sinais/socio-fornecedor", label: "Sinais · Sócio de fornecedor" },
  { href: "/sinais/analise-ia", label: "Sinais · Análise de IA" },
  { href: "/sinais/discurso", label: "Sinais · Discurso em rede social" },
];

export function useCommandPaletteShortcut() {
  const { paletteOpen, setPaletteOpen } = useShell();
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [paletteOpen, setPaletteOpen]);
}

export function CommandPalette() {
  const { setPaletteOpen } = useShell();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPaletteOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [setPaletteOpen]);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const trimmed = q.trim();
  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: { results: SearchResult[] }) => setResults(d.results))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 180);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [trimmed]);

  const shownResults = trimmed.length < 2 ? [] : results;

  const go = (href: string) => {
    setPaletteOpen(false);
    router.push(href);
  };

  const shortcuts = SHORTCUTS.filter((s) => s.label.toLowerCase().includes(trimmed.toLowerCase()));

  return (
    <div className="palette__backdrop" onClick={() => setPaletteOpen(false)}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette__input">
          <span className="mono" style={{ color: "var(--muted-2)" }}>⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar candidato, página, ação…"
          />
          <span className="input__kbd">Esc</span>
        </div>
        <div className="palette__list">
          {trimmed.length < 2 ? (
            shortcuts.map((s) => (
              <button key={s.href} type="button" className="palette__row" onClick={() => go(s.href)}>
                {s.label}
                <span className="palette__group">ir para</span>
              </button>
            ))
          ) : loading ? (
            <div className="palette__empty">Buscando…</div>
          ) : shownResults.length === 0 && shortcuts.length === 0 ? (
            <div className="palette__empty">Nada encontrado.</div>
          ) : (
            <>
              {shortcuts.map((s) => (
                <button key={s.href} type="button" className="palette__row" onClick={() => go(s.href)}>
                  {s.label}
                  <span className="palette__group">ir para</span>
                </button>
              ))}
              {shownResults.map((r) =>
                r.kind === "candidato" ? (
                  <button
                    key={`c-${r.personId}`}
                    type="button"
                    className="palette__row"
                    onClick={() => go(`/politico/${r.personId}`)}
                  >
                    <SearchAvatar photoUrl={r.photoUrl} name={r.canonicalName} />
                    <span className="num" style={{ color: "var(--muted-2)", fontSize: 11 }}>
                      {r.cpf ? formatCpfCnpj(r.cpf) : "—"}
                    </span>
                    {r.canonicalName}
                    <span className="palette__group">
                      {r.latestOffice ?? "candidato"} {r.latestYear}
                    </span>
                  </button>
                ) : (
                  <button
                    key={`p-${r.cpf}`}
                    type="button"
                    className="palette__row"
                    onClick={() => go(`/cpf/${r.cpf}`)}
                  >
                    <SearchAvatar photoUrl={null} name={r.canonicalName} />
                    <span className="num" style={{ color: "var(--muted-2)", fontSize: 11 }}>
                      {formatCpfCnpj(r.cpf)}
                    </span>
                    {r.canonicalName}
                    <span className="palette__group">pessoa física</span>
                  </button>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
