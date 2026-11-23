import { requireCtx } from "@/lib/session";
import { QrScanner } from "@/components/qr-scanner";

export const metadata = { title: "Escanear cartão" };

export default async function Escanear() {
  await requireCtx();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div><h1>Escanear cartão</h1><p className="hint">Aponte a câmera para o QR do cartão-resposta. Você confere as respostas e a nota segue para a escola.</p></div>
      <section className="card"><QrScanner /></section>
    </div>
  );
}
