import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { AppHeader } from "@/components/app-header";
import { RegisterServiceWorker } from "@/components/register-service-worker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nearby Bids",
  description: "Post what you want to buy, let nearby shops bid on it.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ea580c",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <RegisterServiceWorker />
        <AuthProvider>
          <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white shadow-sm sm:my-4 sm:min-h-0 sm:rounded-2xl sm:border sm:border-neutral-100 dark:bg-neutral-900 dark:shadow-none dark:sm:border-neutral-800">
            <AppHeader />
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
