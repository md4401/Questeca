import { requireCtx } from "@/lib/session";
import { PageHead } from "@/components/page-head";
import { QrScanner } from "@/components/qr-scanner";

export const metadata = { title: "Escanear cartão" };

export default async function Escanear() {
  await requireCtx();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHead icon="chamada" title="Escanear cartão" sub="Aponte a câmera para o QR do cartão-resposta. Você confere as respostas e a nota segue para a escola." />
      <section className="card"><QrScanner /></section>
    </div>
  );
}
