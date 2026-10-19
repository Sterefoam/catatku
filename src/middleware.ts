import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "catatku_session";

/**
 * Lapisan pertama proteksi rute: bila tidak ada cookie sesi, arahkan ke /login.
 * Verifikasi sesi sebenarnya tetap dilakukan di server (layout & route API).
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (hasSession) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|icons|manifest.webmanifest|sw.js|offline|favicon.ico|login|register|icon.svg).*)",
  ],
};
