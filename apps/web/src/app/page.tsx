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
    <main className="flex flex-1 flex-col justify-center gap-8 px-6 py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-orange-600">Nearby Bids</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Post what you want to buy — nearby shops compete for your business.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/login?role=customer"
          className="rounded-xl bg-orange-600 px-4 py-4 text-center font-medium text-white active:bg-orange-700"
        >
          I&apos;m a Customer
        </Link>
        <Link
          href="/login?role=shop_owner"
          className="rounded-xl border border-orange-600 px-4 py-4 text-center font-medium text-orange-600 active:bg-orange-50"
        >
          I&apos;m a Shop Owner
        </Link>
        <Link
          href="/login?role=admin"
          className="px-4 py-2 text-center text-sm text-neutral-400 underline"
        >
          Admin sign in
        </Link>
      </div>
    </main>
  );
}
