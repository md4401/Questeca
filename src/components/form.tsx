"use client";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

export type FormState = { error?: string; ok?: string; fieldErrors?: Record<string, string> } | null;
type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function SubmitButton({ children, className = "btn", pendingLabel }: { children: React.ReactNode; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (pendingLabel ?? "Aguarde…") : children}
    </button>
  );
}

/** Formulário com ação de servidor, mensagens de erro/sucesso acessíveis e reset opcional. */
export function Form({ action, children, className, resetOnOk }: { action: Action; children: React.ReactNode; className?: string; resetOnOk?: boolean }) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && resetOnOk) ref.current?.reset(); }, [state, resetOnOk]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div aria-live="polite" role="status">
        {state?.error && <p className="err" role="alert">{state.error}</p>}
        {state?.ok && <p className="ok">{state.ok}</p>}
      </div>
    </form>
  );
}

export function Field({ label, name, type = "text", required, hint, defaultValue, autoComplete, placeholder, min, max, step }: {
  label: string; name: string; type?: string; required?: boolean; hint?: string; defaultValue?: string | number; autoComplete?: string; placeholder?: string; min?: number; max?: number; step?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} required={required} defaultValue={defaultValue} autoComplete={autoComplete} placeholder={placeholder} min={min} max={max} step={step} className="input" aria-describedby={hint ? `${name}-hint` : undefined} />
      {hint && <span id={`${name}-hint`} className="hint">{hint}</span>}
    </div>
  );
}

export function ConfirmButton({ children, message, className = "link-btn" }: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
