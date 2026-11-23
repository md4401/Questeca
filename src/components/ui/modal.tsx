"use client";
import { useEffect, useRef } from "react";

/** Modal acessível sobre <dialog> nativo: foco preso, Esc fecha, clique fora fecha. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" aria-labelledby="modal-title" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="modal-panel glass glass-strong p-6">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 id="modal-title" className="text-2xl">{title}</h2>
          <button type="button" className="link-btn text-xl" aria-label="Fechar" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
