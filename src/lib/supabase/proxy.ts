import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./env";

/** Routes that must stay reachable without a session. */
const PUBLIC_ROUTES = ["/login", "/setup", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function toSetup(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/setup";
  url.search = "";
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  const env = supabaseConfig();
  const pathname = request.nextUrl.pathname;

  // No credentials in this deployment: show the setup page instead of crashing.
  if (!env) {
    return pathname.startsWith("/setup")
      ? NextResponse.next({ request })
      : toSetup(request);
  }

  let response = NextResponse.next({ request });

  let supabase;
  try {
    supabase = createServerClient(env.url, env.key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
  } catch {
    // Malformed URL/key: point at the setup page rather than returning a 500.
    return pathname.startsWith("/setup")
      ? NextResponse.next({ request })
      : toSetup(request);
  }

  // Verifies the JWT signature and refreshes cookies when needed.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  if (!signedIn && !isPublic(pathname)) {
    // Auth guard: remember where the user was heading, then send them to sign in.
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return response;
}
