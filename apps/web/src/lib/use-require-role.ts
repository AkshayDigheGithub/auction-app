"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, type Role } from "./auth-context";

/** Redirects to login unless the current user has one of `roles`. */
export function useRequireRole(...roles: Role[]) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user || !roles.includes(user.role)) {
      router.replace(`/login?role=${roles[0]}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, router]);

  return { user, ready };
}
