import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_TYPES = new Set(["recovery", "invite", "signup", "email", "magiclink", "email_change"]);

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") ?? "";
  const destination = safeNext(request.nextUrl.searchParams.get("next"));
  const failureUrl = new URL("/login?error=link_expirado", request.url);

  if (!tokenHash || !ALLOWED_TYPES.has(type)) {
    return NextResponse.redirect(new URL("/login?error=link_invalido", request.url));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return new NextResponse("Autenticação indisponível.", { status: 503 });

  let response = NextResponse.redirect(new URL(destination, request.url));
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.redirect(new URL(destination, request.url));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "recovery" | "invite" | "signup" | "email" | "magiclink" | "email_change",
  });

  if (error) {
    console.error("[auth:confirm]", error.message);
    return NextResponse.redirect(failureUrl);
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
