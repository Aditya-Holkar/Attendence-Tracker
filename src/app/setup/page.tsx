import { Card } from "@/components/ui";
import { ThemeToggle } from "@/components/theme-toggle";

// Read the environment at request time, not at build time.
export const dynamic = "force-dynamic";

export const metadata = { title: "Setup" };

export default function SetupPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">Tracker</span>
        <ThemeToggle />
      </div>
      <h1 className="text-2xl font-semibold">Configuration needed</h1>
      <p className="mt-2 text-sm text-muted">
        The app is running, but it can’t reach Supabase yet. Add the two environment variables below and
        redeploy. Until then, every page lands here instead of returning an internal server error.
      </p>

      <Card title="Environment variables" className="mt-6">
        <ul className="space-y-3 text-sm">
          <li className="flex flex-wrap items-center justify-between gap-2">
            <code className="rounded bg-surface-2 px-2 py-1">NEXT_PUBLIC_SUPABASE_URL</code>
            <span className={url ? "text-work" : "text-alert"}>{url ? `Set — ${url}` : "Missing"}</span>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <code className="rounded bg-surface-2 px-2 py-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>
            <span className={key ? "text-work" : "text-alert"}>
              {key ? `Set — ${key.slice(0, 16)}…` : "Missing"}
            </span>
          </li>
        </ul>
        <p className="mt-4 text-xs text-muted">
          Copy both from your Supabase project: Project Settings → API. Only the publishable/anon key
          belongs here — never the service-role key.
        </p>
      </Card>

      <Card title="On Vercel" className="mt-4">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Open your project on vercel.com → <strong>Settings → Environment Variables</strong>.</li>
          <li>Add both variables for <strong>Production</strong> (add them to Preview too if you use preview deploys).</li>
          <li>Go to <strong>Deployments → the latest one → ⋯ → Redeploy</strong>.</li>
          <li>
            In Supabase: <strong>Authentication → URL Configuration</strong> — set <em>Site URL</em> to your
            Vercel domain and add it to <em>Redirect URLs</em>.
          </li>
        </ol>
        <p className="mt-3 text-xs text-muted">
          <code>NEXT_PUBLIC_*</code> values are baked in at build time, so a plain restart is not enough —
          you must trigger a new deployment after adding them.
        </p>
      </Card>

      <Card title="Locally" className="mt-4">
        <p className="text-sm">Create <code>.env.local</code> in the project root:</p>
        <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-3 text-xs text-slate-100">{`NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY`}</pre>
        <p className="mt-2 text-sm text-muted">Then restart <code>npm run dev</code>.</p>
      </Card>
    </main>
  );
}
