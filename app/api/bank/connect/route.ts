import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startAuth } from "@/lib/enable-banking";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { origin, searchParams } = new URL(request.url);

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const aspspName = searchParams.get("aspsp_name");
  const aspspCountry = searchParams.get("aspsp_country");

  if (!aspspName || !aspspCountry) {
    return NextResponse.redirect(`${origin}/bank/connect?bank_error=missing_aspsp`);
  }

  const state = randomUUID();
  // 180 Tage – Maximum, das die meisten Banken laut Enable-Banking-ASPSP-Daten erlauben.
  const validUntil = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const auth = await startAuth({
      aspspName,
      aspspCountry,
      redirectUrl: `${origin}/api/bank/callback`,
      state,
      validUntil,
    });

    const response = NextResponse.redirect(auth.url);
    response.cookies.set("eb_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.redirect(`${origin}/bank/connect?bank_error=start_failed`);
  }
}
