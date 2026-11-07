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
  const isAuthRoute = pathname.startsWith("/auth") || pathname === "/definir-senha";
  const isPublicPresentation = pathname.startsWith("/apresentacao/");
  const isPublicListings = pathname === "/imoveis" || pathname.startsWith("/api/public/media/");

  let authorized = false;
  let userRole: string | null = null;
  if (user && !authError) {
    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    userRole = roleRow?.role ?? null;
    authorized = !roleError && ["admin", "member", "reader"].includes(userRole ?? "");
  }

  if (!user && !isLoginPage && !isAuthRoute && !isPublicPresentation && !isPublicListings && !isDeniedPage) {
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

  if (user && authorized && userRole !== "admin") {
    const guestAllowed =
      pathname === "/" ||
      (pathname.startsWith("/areas") && !pathname.startsWith("/areas/nova") && !pathname.includes("/editar")) ||
      pathname.startsWith("/mapa") ||
      pathname.startsWith("/indicadores") ||
      pathname.startsWith("/api/areas") ||
      pathname.startsWith("/api/media/") ||
      pathname.startsWith("/api/ibge/") ||
      pathname.startsWith("/api/map") ||
      isPublicPresentation || isPublicListings || isAuthRoute || isLoginPage;
    if (!guestAllowed) {
      if (pathname.startsWith("/api/")) return Response.json({ ok: false, error: "Este módulo é exclusivo do administrador." }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
      const denied = NextResponse.redirect(new URL("/acesso-negado", request.url));
      copyCookies(response, denied);
      denied.headers.set("Cache-Control", "private, no-store");
      return denied;
    }
  }

  if (user && authorized && userRole !== "admin" && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && !isAuthRoute && !isPublicPresentation) {
    if (pathname.startsWith("/api/")) {
      return Response.json({ ok: false, error: "Perfil somente leitura: apenas administradores podem cadastrar, editar, excluir ou enviar arquivos." }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    }
    return new NextResponse("Perfil somente leitura: esta operação não é permitida.", { status: 403, headers: { "Cache-Control": "private, no-store" } });
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
