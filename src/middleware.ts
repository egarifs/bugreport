import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, api auth, and public routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  const session = await auth();
  const user = session?.user as
    | { id?: string; email?: string; status?: string; isAdmin?: boolean }
    | undefined;

  // If not logged in
  if (!user || !user.email) {
    if (pathname === "/login") return NextResponse.next();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If user is PENDING, REJECTED, or SUSPENDED
  if (user.status !== "ACTIVE") {
    if (pathname === "/pending") return NextResponse.next();
    return NextResponse.redirect(new URL("/pending", request.url));
  }

  // If active user visits /pending or /login, redirect to /projects
  if (pathname === "/pending" || pathname === "/login" || pathname === "/") {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  // Protect /admin routes
  if (pathname.startsWith("/admin") && !user.isAdmin) {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
