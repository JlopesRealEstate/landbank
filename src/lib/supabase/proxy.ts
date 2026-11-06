import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value, ...options }) => {
    to.cookies.set(name, value, options);
  });
}

function safeNextUrl(value: string | null, origin: string) {
  const fallback = new URL("/", origin);
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const target = new URL(value, origin);
    return target.origin === origin ? target : fallback;
  } catch {
    return fallback;
  }
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Fail closed: a missing Supabase configuration must never expose the CRM.
  if (!url || !key) {
    return new NextResponse("Autenticação indisponível: configure as variáveis do Supabase.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });

  // Validate the user with Auth (not by destructuring JWT claims, which can be null).
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData?.user ?? null;
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isDeniedPage = pathname === "/acesso-negado";
  const isAuthRoute = pathname.startsWith("/auth");
  const isPublicPresentation = pathname.startsWith("/apresentacao/");

  let authorized = false;
  if (user && !authError) {
    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    authorized = !roleError && ["admin", "member", "reader"].includes(roleRow?.role ?? "");
  }

  if (!user && !isLoginPage && !isAuthRoute && !isPublicPresentation && !isDeniedPage) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ ok: false, error: "Autenticação necessária." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(loginUrl);
    copyCookies(response, redirect);
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  if (user && !authorized && !isAuthRoute && !isPublicPresentation && !isDeniedPage) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ ok: false, error: "Acesso não autorizado. Solicite liberação ao administrador." }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    }
    const denied = NextResponse.redirect(new URL("/acesso-negado", request.url));
    copyCookies(response, denied);
    denied.headers.set("Cache-Control", "private, no-store");
    return denied;
  }

  if (user && authorized && (isLoginPage || isDeniedPage)) {
    const destination = safeNextUrl(request.nextUrl.searchParams.get("next"), request.nextUrl.origin);
    const redirect = NextResponse.redirect(destination);
    copyCookies(response, redirect);
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
