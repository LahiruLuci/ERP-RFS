import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function isSafeNext(value: string | null): boolean {
  if (!value) {
    return false;
  }

  return value.startsWith("/") && !value.startsWith("//");
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const token = requestUrl.searchParams.get("token");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const errorCode = requestUrl.searchParams.get("error_code");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const next = requestUrl.searchParams.get("next");
  const safeNext: string = isSafeNext(next) ? (next as string) : "/login";

  if (process.env.NODE_ENV !== "production") {
    console.log("[recovery-debug] callback received", {
      hasCode: Boolean(code),
      hasError: Boolean(error),
      hasToken: Boolean(token),
      hasTokenHash: Boolean(tokenHash),
      type: type ?? null,
      errorCode: errorCode ?? null,
      hasErrorDescription: Boolean(errorDescription),
      next: safeNext,
    });
  }

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[recovery-debug] callback error", { error, errorCode, errorDescription });
    }

    const target =
      error === "access_denied"
        ? "/forgot-password?error=access_denied"
        : "/forgot-password?error=invalid_link";

    return NextResponse.redirect(new URL(target, requestUrl.origin));
  }

  if (!code) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[recovery-debug] callback missing code, redirecting to forgot-password");
    }

    return NextResponse.redirect(
      new URL("/forgot-password?error=invalid_link", requestUrl.origin),
    );
  }

  const supabase = await createClient();

  let hasVerifierCookie = false;
  let verifierCookieCount = 0;

  if (process.env.NODE_ENV !== "production") {
    try {
      const cookieStore = await import("next/headers").then((m) => m.cookies());
      const allCookies = await cookieStore.getAll();
      verifierCookieCount = allCookies.length;
      hasVerifierCookie = allCookies.some((cookie) =>
        cookie.name.endsWith("-code-verifier"),
      );
    } catch (cookieInspectError) {
      console.log("[recovery-debug] cookie inspection failed:", cookieInspectError);
    }
  }

  try {
    if (process.env.NODE_ENV !== "production") {
      console.log("[recovery-debug] attempting exchangeCodeForSession", {
        hasVerifierCookie,
        verifierCookieCount,
      });
    }

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[recovery-debug] code exchange failed", {
          message: exchangeError.message,
          status: exchangeError.status,
          code: exchangeError.code,
        });
      }

      return NextResponse.redirect(
        new URL("/forgot-password?error=invalid_link", requestUrl.origin),
      );
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[recovery-debug] code exchange succeeded");
    }
  } catch (exchangeException) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[recovery-debug] exchangeCodeForSession threw:", exchangeException);
    }

    return NextResponse.redirect(
      new URL("/forgot-password?error=invalid_link", requestUrl.origin),
    );
  }

  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}
