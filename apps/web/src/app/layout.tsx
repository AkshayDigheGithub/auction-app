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

export const metadata: Metadata = {
  title: "mivikto.store",
  description: "Post what you want to buy, let nearby shops bid on it.",
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
