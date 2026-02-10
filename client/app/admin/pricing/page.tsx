"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPricingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/waste');
  }, [router]);
  return null;
}
