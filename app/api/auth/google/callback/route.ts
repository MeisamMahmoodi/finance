import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, fetchGoogleEmail } from "@/lib/google-oauth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = request.headers.get("cookie") ?? "";
  const expectedState = cookieStore
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("google_oauth_state="))
    ?.split("=")[1];

  if (error) {
    return NextResponse.redirect(`${origin}/settings?gmail_error=denied`);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/settings?gmail_error=state_mismatch`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code, origin);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${origin}/settings?gmail_error=no_refresh_token`);
    }

    const email = await fetchGoogleEmail(tokens.access_token);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${origin}/login`);
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error: rpcError } = await supabase.rpc("save_gmail_connection", {
      p_email: email,
      p_refresh_token: tokens.refresh_token,
      p_access_token: tokens.access_token,
      p_expires_at: expiresAt,
      p_key: process.env.TOKEN_ENCRYPTION_KEY,
    });

    if (rpcError) {
      return NextResponse.redirect(`${origin}/settings?gmail_error=save_failed`);
    }

    const response = NextResponse.redirect(`${origin}/settings?gmail_connected=1`);
    response.cookies.delete("google_oauth_state");
    return response;
  } catch {
    return NextResponse.redirect(`${origin}/settings?gmail_error=exchange_failed`);
  }
}
