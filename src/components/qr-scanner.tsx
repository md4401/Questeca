"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tokenFromScan } from "@/lib/core/scan";

type Detector = { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> };

/** Lê o QR do cartão pela câmera (BarcodeDetector, Chrome/Android). Sem suporte, cola-se o link/código. */
export function QrScanner() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState("");
  const [manual, setManual] = useState("");
  useEffect(() => { setSupported(typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia); }, []);
  useEffect(() => {
    if (!on) return;
    let stop = false; let stream: MediaStream | null = null;
    (async () => {
      try {
        const Det = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        const det = new Det({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = video.current!; v.srcObject = stream; await v.play();
        while (!stop) {
          const found = await det.detect(v).catch(() => []);
          const tok = found[0] ? tokenFromScan(found[0].rawValue) : "";
          if (tok) { router.push(`/app/g/${encodeURIComponent(tok)}`); return; }
          await new Promise((r) => setTimeout(r, 300));
        }
      } catch { setErr("Não consegui acessar a câmera. Cole o link do QR abaixo."); setOn(false); }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [on, router]);
  const go = (e: React.FormEvent) => { e.preventDefault(); const tok = tokenFromScan(manual); if (!tok) { setErr("Cole o link ou o código do cartão."); return; } router.push(`/app/g/${encodeURIComponent(tok)}`); };
  return (
    <div className="space-y-4">
      {supported && (on ? <div><video ref={video} className="w-full rounded-lg bg-black" playsInline muted aria-label="Câmera para ler o QR" /><button type="button" className="btn btn-ghost mt-2" onClick={() => setOn(false)}>Parar câmera</button></div>
        : <button type="button" className="btn btn-lg" onClick={() => { setErr(""); setOn(true); }}>Abrir câmera e escanear</button>)}
      {!supported && <p className="hint">Este navegador não lê QR pela câmera. Use a câmera do celular (o QR abre o link) ou cole abaixo.</p>}
      <form onSubmit={go} className="flex flex-wrap items-end gap-2">
        <div className="field !mb-0 min-w-[16rem] flex-1"><label htmlFor="manual">Link ou código do cartão</label><input id="manual" className="input" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Cole o link do QR" /></div>
        <button className="btn btn-ghost" type="submit">Abrir cartão</button>
      </form>
      {err && <p role="alert" className="text-danger">{err}</p>}
    </div>
  );
}
