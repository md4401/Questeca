"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Barra fixa com a mesma ação principal, só no celular e só depois que o botão da abertura sai da tela. */
export function StickyCta({ targetId }: { targetId: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);
  return (
    <>
      <div aria-hidden className="h-20 md:hidden" />
      {show && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
          <Link className="btn btn-lg w-full" href="/criar-conta">Criar minha primeira prova</Link>
        </div>)}
    </>
  );
}
