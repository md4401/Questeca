"use client";
import { useEffect } from "react";

/**
 * Efeitos de rolagem da página pública, num único laço com requestAnimationFrame:
 * - .reveal → entra quando aparece (scroll trigger)
 * - [data-parallax="0.2"] → desloca proporcional à posição (parallax)
 * - --page-progress no <html> → barra de progresso (scroll linked)
 * Respeita prefers-reduced-motion.
 */
export function ScrollFX() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("no-js");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    if (reduce) return () => io.disconnect();

    const par = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
    let raf = 0;
    const tick = () => {
      raf = 0;
      const max = root.scrollHeight - innerHeight;
      root.style.setProperty("--page-progress", String(max > 0 ? scrollY / max : 0));
      for (const el of par) {
        const r = el.parentElement!.getBoundingClientRect();
        const speed = Number(el.dataset.parallax || 0.2);
        const offset = (r.top + r.height / 2 - innerHeight / 2) * -speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => { io.disconnect(); removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);
  return <div aria-hidden className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-gradient-to-r from-[#5B8CFF] to-brand" style={{ transform: "scaleX(var(--page-progress, 0))" }} />;
}
