import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthProvider } from "@/lib/auth-context";
import { CLERK_ENABLED, POST_SSO_PATH } from "@/lib/clerk";
import { AppHeader } from "@/components/app-header";
import { AppShell } from "@/components/app-shell";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The app subdomain, as an absolute origin. Without metadataBase, Next resolves
 * Open Graph and canonical URLs against localhost and warns at build time.
 *
 * Hardcoded for production rather than read from vercel.json's build.env: that
 * key silently disables Vercel's Next.js framework preset (see APP_URL in
 * apps/site/src/lib/site.ts for the same trap). NEXT_PUBLIC_APP_URL still wins
 * where it is set.
 */
const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://app.mivikto.store"
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(APP_ORIGIN),
  title: "mivikto.store",
  description: "Post what you want to buy, let nearby shops bid on it.",
  // This app is a signed-in tool, not content, and every route under it shares
  // this one title — indexing twelve near-identical pages would compete with
  // the marketing site on the apex for the site's own brand terms.
  //
  // This is the authoritative exclusion, not robots.ts. robots.ts deliberately
  // allows crawling so that this tag can actually be read; a Disallow there
  // would hide it and leave the URLs eligible for bare, description-less
  // listings. See the comment in apps/web/src/app/robots.ts before changing
  // either one.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ea580c",
  colorScheme: "light dark",
};

/**
 * ClerkProvider throws without a publishable key, so it is only mounted when
 * one is configured. With it unset the app falls back to the phone OTP login
 * and needs no Clerk account — which is what local development runs on.
 *
 * CLERK_ENABLED is a build-time constant, so this branch never changes between
 * renders and the tree below it keeps a stable shape.
 *
 * The redirect defaults are set here as well as at each call site, because the
 * one Clerk ships is "/" — the marketing landing page — and a sign-in that ends
 * there is signed in with Clerk and signed out of this app, /login being the
 * only screen that exchanges the one for the other. Naming them here means a
 * flow nobody anticipated still lands somewhere that can finish the job, rather
 * than on a page inviting the user to start over.
 */
function AuthShell({ children }: { children: React.ReactNode }) {
  if (!CLERK_ENABLED) return <>{children}</>;
  return (
    <ClerkProvider
      signInFallbackRedirectUrl={POST_SSO_PATH}
      signUpFallbackRedirectUrl={POST_SSO_PATH}
      // Where Clerk's own signOut() navigates. The header navigates there too
      // once it resolves (see ClerkLogout), so the two agree instead of racing
      // for different destinations.
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <RegisterServiceWorker />
        <AuthShell>
          <AuthProvider>
            <AppShell>
              <AppHeader />
              {children}
            </AppShell>
          </AuthProvider>
        </AuthShell>
        <Analytics />
      </body>
    </html>
  );
}
