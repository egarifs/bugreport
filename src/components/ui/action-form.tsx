"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

export type ActionResult = { error?: string; ok?: string } | void;
type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

// Form wrapper for server actions: shows validation errors inline instead of failing silently.
export function ActionForm({
  action,
  children,
  className,
  encType,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  encType?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className} encType={encType}>
      {children}
      <p role="status" aria-live="polite" className="text-sm empty:hidden">
        {state?.error && <span className="block mt-2 text-sev-blocker font-bold">{state.error}</span>}
        {state?.ok && <span className="block mt-2 text-slate-700">{state.ok}</span>}
      </p>
    </form>
  );
}

// Disabled while pending so a double click never submits twice.
export function SubmitButton({
  children,
  pendingText,
  className = "px-3.5 py-2 bg-action hover:bg-action-hover text-white text-sm font-bold rounded",
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={`${className} disabled:opacity-60 disabled:cursor-wait`}>
      {pending ? pendingText : children}
    </button>
  );
}
