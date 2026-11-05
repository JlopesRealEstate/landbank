import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value, ...options }) => {
    to.cookies.set(name, value, options);
  });
}

function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
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

  // Validate the JWT signature and refresh the session before rendering.
  const { data: { claims }, error } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(claims && !error);
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isAuthRoute = pathname.startsWith("/auth");

  if (!isAuthenticated && !isLoginPage && !isAuthRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(loginUrl);
    copyCookies(response, redirect);
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  if (isAuthenticated && isLoginPage) {
    const destination = safeNextPath(request.nextUrl.searchParams.get("next"));
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = destination;
    redirectUrl.search = "";
    const redirect = NextResponse.redirect(redirectUrl);
    copyCookies(response, redirect);
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
