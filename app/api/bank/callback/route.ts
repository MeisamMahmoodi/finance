import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeSession } from "@/lib/enable-banking";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = request.headers.get("cookie") ?? "";
  const expectedState = cookieStore
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("eb_oauth_state="))
    ?.split("=")[1];

  if (error) {
    return NextResponse.redirect(`${origin}/settings?bank_error=denied`);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/settings?bank_error=state_mismatch`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    const session = await exchangeSession(code);

    const { data: connection, error: connError } = await supabase
      .from("bank_connections")
      .insert({
        user_id: user.id,
        aspsp_name: session.aspsp.name,
        aspsp_country: session.aspsp.country,
        session_id: session.session_id,
        status: "connected",
        valid_until: session.access.valid_until,
      })
      .select("id")
      .single();

    if (connError || !connection) {
      return NextResponse.redirect(`${origin}/settings?bank_error=save_failed`);
    }

    const accountRows = session.accounts.map((acc) => ({
      connection_id: connection.id,
      user_id: user.id,
      account_uid: acc.uid,
      iban: acc.account_id?.iban ?? null,
      name: acc.name ?? null,
      currency: acc.currency ?? null,
    }));

    if (accountRows.length > 0) {
      await supabase.from("bank_accounts").insert(accountRows);
    }

    const response = NextResponse.redirect(`${origin}/settings?bank_connected=1`);
    response.cookies.delete("eb_oauth_state");
    return response;
  } catch {
    return NextResponse.redirect(`${origin}/settings?bank_error=exchange_failed`);
  }
}
