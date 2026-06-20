import NextAuth, { type DefaultSession } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";
import { env } from "@/lib/env";
import type { UserId } from "@/lib/db/ids";
import { setEncryptedRefreshToken, upsertUserByGoogleId } from "@/lib/db/queries/users";

// Auth.js v5 — JWT sessions, no DB adapter (ADR-008). The app owns the users
// table; the refresh token is encrypted and persisted in the jwt callback on the
// originating sign-in (the one moment it is ever available). Scopes are upfront:
// email, profile, calendar.events. access_type=offline always; prompt=consent is
// NEVER set here — only the dedicated reconnect route forces it (Phase 3, later
// chunk). Verified against next-auth 5.0.0-beta.31 / @auth/core 0.41.

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: { id: UserId } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: UserId;
    accessToken?: string;
    /** Access-token expiry, absolute seconds (Account.expires_at). */
    accessTokenExpires?: number;
  }
}

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: SEVEN_DAYS_SECONDS },
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope:
            "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar.events",
          access_type: "offline",
        },
      },
    }),
  ],
  callbacks: {
    // Gate sign-in on a verified Google email; the email column is not-null.
    signIn({ profile }) {
      return profile?.email_verified === true && typeof profile.email === "string";
    },
    // First sign-in (account present): upsert the user, capture userId into the
    // token, and persist the refresh token encrypted. On later calls the token
    // passes through unchanged. (Upsert lives here, not in signIn, because this
    // is the only callback that can thread userId into the JWT — refines the
    // ADR-008 wording, which describes the two as one step.)
    async jwt({ token, account, user }) {
      if (account && user) {
        const email = user.email;
        if (!email) {
          throw new Error("Google sign-in returned no email");
        }
        const userId = await upsertUserByGoogleId({
          googleId: account.providerAccountId,
          email,
          name: user.name ?? null,
          imageUrl: user.image ?? null,
        });
        token.userId = userId;
        token.accessToken = account.access_token;
        token.accessTokenExpires = account.expires_at;
        if (account.refresh_token) {
          await setEncryptedRefreshToken(userId, account.refresh_token);
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId;
      }
      session.accessToken = token.accessToken;
      return session;
    },
  },
});
