import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encode, getToken } from "next-auth/jwt";

export async function GET(request: Request) {
  const session = await auth();
  const email = session?.user?.email;
  const url = new URL(request.url);
  const baseUrl = url.origin;

  if (!email) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  const dbUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, status: true, isAdmin: true },
  });

  if (dbUser?.status === "ACTIVE") {
    const secure = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").startsWith("https://");
    const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";
    const existingToken = await getToken({
      req: {
        headers: Object.fromEntries(request.headers.entries()),
      },
      secret: process.env.AUTH_SECRET,
      secureCookie: secure,
    });

    const response = NextResponse.redirect(`${baseUrl}/projects`);

    if (existingToken) {
      const updatedToken = {
        ...existingToken,
        userId: dbUser.id,
        status: dbUser.status,
        isAdmin: dbUser.isAdmin,
      };
      const newCookieVal = await encode({
        token: updatedToken,
        secret: process.env.AUTH_SECRET!,
        salt: cookieName,
      });

      response.cookies.set(cookieName, newCookieVal, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
      });
    }

    return response;
  }

  return NextResponse.redirect(`${baseUrl}/pending`);
}
