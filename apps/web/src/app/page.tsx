"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const ROLE_HOME: Record<string, string> = {
  customer: "/request/new",
  shop_owner: "/nearby",
  admin: "/admin",
};

export default function Home() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) router.replace(ROLE_HOME[user.role] ?? "/");
  }, [ready, user, router]);

  return (
    <main className="flex flex-1 flex-col justify-center gap-10 px-6 py-12">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-2xl">
          🛍️
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
          Post it. Let shops bid.
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-neutral-500 dark:text-neutral-400">
          Post what you want to buy and nearby shops compete for your business — best price wins.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/login?role=customer"
          className="rounded-xl bg-orange-600 px-4 py-4 text-center font-medium text-white transition active:bg-orange-700"
        >
          I&apos;m a Customer
        </Link>
        <Link
          href="/login?role=shop_owner"
          className="rounded-xl border border-orange-600 px-4 py-4 text-center font-medium text-orange-600 transition active:bg-orange-50 dark:border-orange-500 dark:text-orange-400 dark:active:bg-orange-950/40"
        >
          I&apos;m a Shop Owner
        </Link>
        <Link
          href="/login?role=admin"
          className="px-4 py-2 text-center text-sm text-neutral-400 underline decoration-dotted underline-offset-2 dark:text-neutral-500"
        >
          Admin sign in
        </Link>
      </div>
    </main>
  );
}
