import { NextResponse, type NextRequest } from "next/server";

const SIGNED_IN_COOKIE = "mens-store-signed-in";

/**
 * Edge middleware: redirects unauthenticated visitors away from /admin/* before
 * client JS loads. Verifies presence of a session-marker cookie set by
 * AuthProvider — does NOT verify identity or admin role (that needs
 * firebase-admin + a session cookie). AdminGuard still enforces the role check
 * client-side and Firestore rules enforce it server-side.
 *
 * Net effect: signed-out users see the sign-in page immediately instead of a
 * flash of admin chrome.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const signedIn = req.cookies.get(SIGNED_IN_COOKIE)?.value === "1";

  if (!signedIn) {
    const next = encodeURIComponent(`${pathname}${search}`);
    const url = req.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.search = `?next=${next}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
