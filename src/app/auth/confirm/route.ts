import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set(["recovery", "invite", "signup", "email", "magiclink", "email_change"]);

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") ?? "";
  const destination = safeNext(request.nextUrl.searchParams.get("next"));

  if (!tokenHash || !ALLOWED_TYPES.has(type)) {
    return NextResponse.redirect(new URL("/login?error=link_invalido", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "recovery" | "invite" | "signup" | "email" | "magiclink" | "email_change",
  });

  if (error) {
    console.error("[auth:confirm]", error.message);
    return NextResponse.redirect(new URL("/login?error=link_expirado", request.url));
  }

  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
