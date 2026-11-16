"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { btnCls, Field, inputCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (err === "inactive") setMsg("Your account is inactive. Ask an admin to re-enable it.");
    else if (err === "link") setMsg("That confirmation link is invalid or has expired. Try signing in, or sign up again.");
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    setBusy(true); setMsg(null);
    const sb = createClient();
    const res = mode === "in"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: String(f.get("name") ?? "") },
            // Confirmation emails come back to this origin, then exchange the code for a session.
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    if (mode === "up" && !res.data.session) return setMsg("Check your email to confirm your account, then sign in.");
    // Return to the page the auth guard sent them away from (internal paths only).
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">Tracker</span>
        <ThemeToggle />
      </div>
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
