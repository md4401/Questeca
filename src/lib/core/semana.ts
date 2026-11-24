/** Segunda-feira (YYYY-MM-DD) da semana da data dada. */
export function semanaDe(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`); const dow = (d.getUTCDay() + 6) % 7; // segunda = 0
  d.setUTCDate(d.getUTCDate() - dow); return d.toISOString().slice(0, 10);
}
/** "Texto | https://…" por linha → links válidos (só http/https). */
export function lerLinks(txt: string): { label: string; url: string }[] {
  return txt.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 10).flatMap((l) => {
    const [a, b] = l.includes("|") ? l.split("|").map((x) => x.trim()) : [l, l];
    try { const u = new URL(b); if (u.protocol !== "http:" && u.protocol !== "https:") return []; return [{ label: (a || b).slice(0, 80), url: u.toString() }]; } catch { return []; }
  });
}
