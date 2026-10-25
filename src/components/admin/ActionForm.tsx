"use client";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/admin/SubmitButton";
import type { ButtonProps } from "@/components/ui/button";
import type { FormState } from "@/server/actions/admin";

/** Formulir aksi server dengan pesan hasil dan (opsional) konfirmasi. */
export function ActionForm({ action, children, submit, variant, size, confirm, className, silent }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children?: React.ReactNode; submit?: string; variant?: ButtonProps["variant"]; size?: ButtonProps["size"];
  confirm?: string; className?: string; silent?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {children}
      {submit && <SubmitButton variant={variant} size={size}>{submit}</SubmitButton>}
      {state.error && <Alert kind="error" className="mt-2">{state.error}</Alert>}
      {!silent && state.ok && state.message && <Alert kind="success" className="mt-2">{state.message}</Alert>}
    </form>
  );
}
