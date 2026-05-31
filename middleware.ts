import { NextResponse, type NextRequest } from "next/server";

const publicRoutes = new Set(["/login", "/register"]);
const sessionCookieNames = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

function hasSessionCookie(request: NextRequest) {
  return sessionCookieNames.some((name) => Boolean(request.cookies.get(name)?.value));
}

export default function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const { pathname } = nextUrl;
  const isPublicRoute = publicRoutes.has(pathname);
  const isAuthApiRoute = pathname.startsWith("/api/auth");
  const isProtectedApiRoute = pathname.startsWith("/api/");
  const hasSession = hasSessionCookie(request);

  if (isAuthApiRoute || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  if (!hasSession && (isProtectedApiRoute || !isPublicRoute)) {
    if (isProtectedApiRoute) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // NOTE: we intentionally do NOT redirect cookie-bearing requests away from
  // /login or /register. Middleware only sees cookie *presence*, not validity —
  // a stale/undecodable session cookie would otherwise bounce /login -> / ->
  // (server can't decode -> requireCurrentUser redirects to /login) -> loop.
  // Letting public routes always render lets the user re-authenticate, which
  // overwrites the bad cookie. Already-authenticated users hitting /login just
  // see the form and can sign in again harmlessly.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
