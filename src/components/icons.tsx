/** Ícones próprios (traço 1.8, 24 px). Decorativos: sempre acompanhados de rótulo. */
const P: Record<string, string> = {
  home: "M4 11.5 12 4l8 7.5M6.5 10v9.5h11V10M10 19.5v-5h4v5",
  prova: "M7 3.5h7.5L19 8v12.5H7zM14 3.5V8h5M10 12h6M10 15.5h6",
  turmas: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 19.5c.4-3 2.6-4.8 5.5-4.8s5.1 1.8 5.5 4.8M16 6.2a3 3 0 0 1 0 5.6M17.5 14.9c1.8.5 2.8 2 3 4.6",
  mais: "M5 12h.01M12 12h.01M19 12h.01",
  banco: "M5 4.5h11a3 3 0 0 1 3 3V19.5H8a3 3 0 0 1-3-3zM5 16.5a3 3 0 0 1 3-3h11M9 8h6",
  coord: "M8 4.5h8M9 3h6v3H9zM6 5.5h12v15H6zM9.5 11h5M9.5 14.5h5",
  chat: "M4.5 5.5h15v10h-8l-4.5 3.5v-3.5h-2.5z",
  material: "M4 7.5 12 4l8 3.5-8 3.5zM4 12l8 3.5 8-3.5M4 16.5 12 20l8-3.5",
  escola: "M3.5 9.5 12 4.5l8.5 5M5.5 10v8.5h13V10M9.5 18.5v-5h5v5",
  ajustes: "M5 7h9M18 7h1M5 17h1M10 17h9M14 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM6 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0z",
  plano: "M4.5 7.5h15v10h-15zM4.5 11h15M8 15h3",
  conta: "M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c.6-3.4 3.2-5 7-5s6.4 1.6 7 5",
  ajuda: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM9.7 9.6a2.4 2.4 0 0 1 4.6.8c0 1.6-2.3 1.9-2.3 3.4M12 16.8h.01",
  sair: "M10 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h4M14.5 8l4 4-4 4M18.5 12H9.5",
  interno: "M12 3.5 19 6v5.5c0 4.3-2.8 7.4-7 9-4.2-1.6-7-4.7-7-9V6z",
};
export type IconName = keyof typeof P;
export function Icon({ name, size = 22, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" className={className}>
      <path d={P[name]} />
    </svg>
  );
}
