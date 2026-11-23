"use client";
import { useEffect, useState } from "react";

type Rec = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number } }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

/** Ditado por voz no navegador (Web Speech API, pt-BR). O texto vai para o campo e pode ser editado antes de salvar. */
export function DictateButton({ targetId }: { targetId: string }) {
  const [supported, setSupported] = useState(false);
  const [rec, setRec] = useState<Rec | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => { setSupported(typeof window !== "undefined" && !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition)); }, []);
  if (!supported) return null;
  const toggle = () => {
    if (on && rec) { rec.stop(); return; }
    const W = window as unknown as Record<string, new () => Rec>;
    const r = new (W.SpeechRecognition || W.webkitSpeechRecognition)();
    r.lang = "pt-BR"; r.interimResults = false; r.continuous = true;
    r.onresult = (e) => {
      const el = document.getElementById(targetId) as HTMLTextAreaElement | null;
      if (!el) return;
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript + " ";
      el.value = (el.value ? el.value.trimEnd() + " " : "") + text.trim();
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    r.onend = () => setOn(false); r.onerror = () => setOn(false);
    r.start(); setRec(r); setOn(true);
  };
  return <button type="button" className="link-btn" onClick={toggle} aria-pressed={on}>{on ? "■ Parar ditado" : "🎤 Ditar observação"}</button>;
}
