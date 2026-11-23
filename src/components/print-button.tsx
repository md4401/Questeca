"use client";
export function PrintButton({ children = "Imprimir" }: { children?: React.ReactNode }) {
  return <button className="btn btn-ghost" type="button" onClick={() => window.print()}>{children}</button>;
}
