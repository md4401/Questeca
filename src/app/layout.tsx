import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: { default: "Segunda Lousa — provas com questões reais", template: "%s · Segunda Lousa" },
  description: "Monte provas com questões reais alinhadas ao que a turma estudou. Da seleção à correção, às notas e à próxima aula.",
  applicationName: "Segunda Lousa",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1F4FE0" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "try{var a=/^\\/(app|admin)(\\/|$)/.test(location.pathname);var t=localStorage.getItem('qs_theme');if(a)document.documentElement.dataset.theme=(t==='dark'||t==='system'||t==='light')?t:'light';}catch(e){}" }} /></head>
      <body>
        <a className="skip" href="#conteudo">Pular para o conteúdo</a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
