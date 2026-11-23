"use client";
import { useEffect, useState } from "react";
import { saveThemeAction } from "@/lib/profile-actions";

export type Theme = "light" | "dark" | "system";
const KEY = "qs_theme";
export function applyTheme(t: Theme) { document.documentElement.dataset.theme = t; try { localStorage.setItem(KEY, t); } catch { /* sem armazenamento */ } }

/** Sincroniza o tema salvo na conta com este aparelho. */
export function ThemeSync({ theme, large }: { theme?: Theme; large?: boolean }) {
  useEffect(() => { if (theme) applyTheme(theme); }, [theme]);
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
