import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Questeca — provas com questões reais", template: "%s · Questeca" },
  description: "Monte provas com questões reais alinhadas ao que a turma estudou. Da seleção à correção, às notas e à próxima aula.",
  applicationName: "Questeca",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#135B4E" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip" href="#conteudo">Pular para o conteúdo</a>
        {children}
      </body>
    </html>
  );
}
