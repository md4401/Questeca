"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Kind = "info" | "success" | "error";
type Toast = { id: number; kind: Kind; text: string };
const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {});

/** Avisos curtos no canto da tela. Também lidos por leitores de tela (role="status"). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: string, kind: Kind = "info") => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-3), { id, kind, text }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), kind === "error" ? 7000 : 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast glass glass-strong" data-kind={t.kind}>
            <span className="toast-dot" aria-hidden />
            <p className="flex-1">{t.text}</p>
            <button type="button" className="link-btn" aria-label="Fechar aviso" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}>×</button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

/** Dispara um toast quando o valor muda (útil para estados de formulário). */
export function useToastOn(state: { ok?: string; error?: string } | null) {
  const toast = useToast();
  useEffect(() => {
    if (state?.ok) toast(state.ok, "success");
    else if (state?.error) toast(state.error, "error");
  }, [state, toast]);
}
