"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { btnCls, Field, inputCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    setBusy(true); setMsg(null);
    const sb = createClient();
    const res = mode === "in"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password, options: { data: { full_name: String(f.get("name") ?? "") } } });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    if (mode === "up" && !res.data.session) return setMsg("Check your email to confirm your account, then sign in.");
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">{mode === "in" ? "Sign in" : "Create account"}</h1>
      <p className="mt-1 text-sm text-muted">Clock in, track breaks and review your timesheet.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "up" && <Field label="Full name"><input name="name" required className={inputCls} /></Field>}
        <Field label="Email"><input name="email" type="email" required autoComplete="email" className={inputCls} /></Field>
        <Field label="Password">
          <input name="password" type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} className={inputCls} />
        </Field>
        {msg && <p className="text-sm text-alert" role="alert">{msg}</p>}
        <button disabled={busy} className={`${btnCls} w-full disabled:opacity-50`}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</button>
      </form>
      <button onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }} className="mt-4 text-sm text-muted underline">
        {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
