import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthProvider } from "@/lib/auth-context";
import { CLERK_ENABLED } from "@/lib/clerk";
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
 */
function AuthShell({ children }: { children: React.ReactNode }) {
  if (!CLERK_ENABLED) return <>{children}</>;
  return <ClerkProvider>{children}</ClerkProvider>;
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
