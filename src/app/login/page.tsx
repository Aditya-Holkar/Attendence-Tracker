"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { siteUrl } from "@/lib/site-url";
import { ThemeToggle } from "@/components/theme-toggle";
import { btnCls, Field, inputCls } from "@/components/ui";

/** Only allow internal paths, and never bounce back to an auth-error URL. */
function safeNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.includes("error_code=") || next.includes("error=access_denied")) return "/";
  return next;
}

/** Supabase puts expired-link errors on the Site URL, which the guard stores in `next`. */
function readAuthError(params: URLSearchParams) {
  const next = params.get("next");
  let nested: URLSearchParams | null = null;
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    try {
      nested = new URL(next, window.location.origin).searchParams;
    } catch {
      nested = null;
    }
  }
  return {
    error: params.get("error") ?? nested?.get("error") ?? null,
    code: params.get("error_code") ?? nested?.get("error_code") ?? null,
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const { error, code } = readAuthError(new URLSearchParams(window.location.search));
    if (error === "inactive") {
      setMsg("Your account is inactive. Ask an admin to re-enable it.");
    } else if (error === "link" || error === "access_denied" || code === "otp_expired") {
      setMsg("That confirmation link is invalid or has expired. Sign in, or create the account again to get a fresh link.");
    }
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
            // Prefer the canonical URL so confirmation emails created on
            // localhost still open the production deployment.
            emailRedirectTo: `${siteUrl() || window.location.origin}/auth/callback`,
          },
        });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    if (mode === "up" && !res.data.session) return setMsg("Check your email to confirm your account, then sign in.");
    // Return to the page the auth guard sent them away from (internal paths only).
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(safeNext(next));
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
