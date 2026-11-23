import { useId } from "react";

/** Dica ao passar o mouse ou focar com o teclado. O texto também é descrição acessível do gatilho. */
export function Tooltip({ text, children }: { text: string; children: React.ReactElement<{ "aria-describedby"?: string }> }) {
  const id = useId();
  return (
    <span className="tip">
      <span aria-describedby={id} className="inline-flex">{children}</span>
      <span role="tooltip" id={id} className="tip-bubble">{text}</span>
    </span>
  );
}
