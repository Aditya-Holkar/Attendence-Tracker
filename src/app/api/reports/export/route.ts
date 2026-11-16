import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/env";
import { aggregate, dailyCsv, fetchDaily, summaryCsv } from "@/lib/reports";

export async function GET(req: NextRequest) {
  if (!supabaseConfig()) return new NextResponse("Supabase is not configured", { status: 503 });

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: me } = await sb.from("profiles").select("role, is_active").eq("id", user.id).single();
  if (!me?.is_active || me.role === "employee") return new NextResponse("Forbidden", { status: 403 });

  const p = req.nextUrl.searchParams;
  const from = p.get("from") ?? "";
  const to = p.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return new NextResponse("Bad dates", { status: 400 });

  const { data: org } = await sb.from("organization_settings").select("*").eq("id", 1).single();
  const rows = await fetchDaily(sb, from, to, p.get("q") ?? undefined); // RLS limits rows to what this user may see
  const type = p.get("type") === "summary" ? "summary" : "daily";
  const csv = type === "summary" ? summaryCsv(aggregate(rows, org?.overtime_after_minutes ?? 480)) : dailyCsv(rows, org?.timezone ?? "Asia/Kolkata");

  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${type}-${from}-to-${to}.csv"` },
  });
}
