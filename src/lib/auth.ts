import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { UserStatus } from "@prisma/client";
import { upsertGoogleUser } from "./user-service";
import { prisma } from "./db";

// ponytail: Credentials provider enabled only for non-production environments to allow deterministic testing without Google OAuth keys
const isDevOrTest = process.env.NODE_ENV !== "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "",
    }),
    ...(isDevOrTest
      ? [
          Credentials({
            id: "dev-login",
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "email" },
              name: { label: "Name", type: "text" },
            },
            async authorize(credentials) {
              const email = typeof credentials?.email === "string" ? credentials.email.trim() : "";
              if (!email) return null;
              const name = typeof credentials?.name === "string" ? credentials.name : email.split("@")[0];
              const user = await upsertGoogleUser({ email, name });
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
              };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      if (account?.provider === "google") {
        await upsertGoogleUser({
          email: user.email,
          name: user.name,
          image: user.image,
        });
      }
      return true;
    },
    async jwt({ token, user }) {
      const email = token.email || user?.email;
      if (email) {
        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, status: true, isAdmin: true },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.status = dbUser.status;
          token.isAdmin = dbUser.isAdmin;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) ?? session.user.id;
        (session.user as unknown as { status: UserStatus; isAdmin: boolean }).status =
          (token.status as UserStatus) ?? UserStatus.PENDING;
        (session.user as unknown as { status: UserStatus; isAdmin: boolean }).isAdmin =
          Boolean(token.isAdmin);
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
