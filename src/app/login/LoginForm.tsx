"use client";
import { useActionState } from "react";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { signIn, type LoginState } from "@/server/actions/auth";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Email"><Input name="email" type="email" autoComplete="username" required /></Field>
      <Field label="Kata sandi"><Input name="password" type="password" autoComplete="current-password" required /></Field>
      <SubmitButton size="lg" className="w-full" pendingText="Masuk...">Masuk</SubmitButton>
    </form>
  );
}
