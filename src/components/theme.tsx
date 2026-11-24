"use client";
import { useEffect, useState } from "react";
import { saveThemeAction } from "@/lib/profile-actions";

export type Theme = "light" | "dark" | "system";
const KEY = "qs_theme";
export function applyTheme(t: Theme) { document.documentElement.dataset.theme = t; try { localStorage.setItem(KEY, t); } catch { /* sem armazenamento */ } }

/** Sincroniza o tema salvo na conta com este aparelho. */
export function ThemeSync({ theme, large }: { theme?: Theme; large?: boolean }) {
  // sem escolha salva, a área logada abre no tema claro (sem gravar no aparelho)
  useEffect(() => { if (theme) applyTheme(theme); else document.documentElement.dataset.theme = (() => { try { return localStorage.getItem(KEY) ?? "light"; } catch { return "light"; } })(); }, [theme]);
  useEffect(() => { document.documentElement.classList.toggle("large", !!large); }, [large]);
  return null;
}

export function ThemePicker({ initial }: { initial: Theme }) {
  const [t, setT] = useState<Theme>(initial);
  const opts: [Theme, string][] = [["light", "Claro"], ["dark", "Escuro"], ["system", "Igual ao aparelho"]];
  return (
    <fieldset><legend className="mb-2 font-semibold">Tema</legend>
      <div className="flex flex-wrap gap-2">{opts.map(([v, label]) => (
        <label key={v} className="chip cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white"><input className="sr-only" type="radio" name="theme" value={v} checked={t === v} onChange={() => { setT(v); applyTheme(v); void saveThemeAction(v); }} />{label}</label>))}</div>
    </fieldset>
  );
}

/** Alternador rápido Claro/Escuro (rodapé do menu). Salva na conta como o seletor da página Minha conta. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.theme !== "light"); }, []);
  return (
    <button type="button" className="nav-link w-full text-left" aria-pressed={dark} onClick={() => { const n: Theme = dark ? "light" : "dark"; setDark(!dark); applyTheme(n); void saveThemeAction(n); }}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={dark ? "M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" : "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"} /></svg>
      <span>{dark ? "Modo claro" : "Modo escuro"}</span>
    </button>
  );
}
