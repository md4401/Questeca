"use client";
import { createContext, startTransition, useActionState, useContext, useRef } from "react";
import { useFormStatus } from "react-dom";

export type FormState = { error?: string; ok?: string; fieldErrors?: Record<string, string> } | null;
type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

const PendingCtx = createContext<boolean | null>(null);

export function SubmitButton({ children, className = "btn", pendingLabel }: { children: React.ReactNode; className?: string; pendingLabel?: string }) {
  const fromCtx = useContext(PendingCtx);
  const fs = useFormStatus();
  const pending = fromCtx ?? fs.pending;
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (pendingLabel ?? "Aguarde…") : children}
    </button>
  );
}

/**
 * Formulário com ação de servidor. Não usa a prop `action` do <form>: o React 19 limparia os campos
 * depois de qualquer resultado (inclusive erro de validação). Aqui os campos só são limpos em caso de
 * sucesso, e apenas quando `resetOnOk` é pedido.
 */
export function Form({ action, children, className, resetOnOk }: { action: Action; children: React.ReactNode; className?: string; resetOnOk?: boolean }) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(async () => {
          await formAction(fd);
          // sucesso: o estado novo chega no próximo render; resetamos de forma otimista só se pedido
        });
      }}
    >
      <PendingCtx.Provider value={pending}>
        {children}
        <ResetOnOk state={state} formRef={ref} enabled={!!resetOnOk} />
        <div aria-live="polite" role="status">
          {state?.error && <p className="err" role="alert">{state.error}</p>}
          {state?.ok && <p className="ok">{state.ok}</p>}
        </div>
      </PendingCtx.Provider>
    </form>
  );
}

function ResetOnOk({ state, formRef, enabled }: { state: FormState; formRef: React.RefObject<HTMLFormElement | null>; enabled: boolean }) {
  const last = useRef<FormState>(null);
  if (enabled && state?.ok && state !== last.current) {
    last.current = state;
    queueMicrotask(() => formRef.current?.reset());
  }
  return null;
}

export function Field({ label, name, id, type = "text", required, hint, defaultValue, autoComplete, placeholder, min, max, step }: {
  label: string; name: string; id?: string; type?: string; required?: boolean; hint?: string; defaultValue?: string | number; autoComplete?: string; placeholder?: string; min?: number; max?: number; step?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id ?? name}>{label}</label>
      <input id={id ?? name} name={name} type={type} required={required} defaultValue={defaultValue} autoComplete={autoComplete} placeholder={placeholder} min={min} max={max} step={step} className="input" aria-describedby={hint ? `${id ?? name}-hint` : undefined} />
      {hint && <span id={`${id ?? name}-hint`} className="hint">{hint}</span>}
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
