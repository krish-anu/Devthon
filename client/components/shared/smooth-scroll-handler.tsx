"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function SmoothScrollHandler() {
  const pathname = usePathname();

  useEffect(() => {
    const headerSelector = "header";

    const scrollToHash = (hash?: string) => {
      if (!hash) return;
      const id = hash.replace('#', '');
      const el = document.getElementById(id);
      if (!el) return;

      const header = document.querySelector(headerSelector) as HTMLElement | null;
      const headerHeight = header ? header.offsetHeight : 64;

      // Compute top position accounting for header offset and small margin
      const rect = el.getBoundingClientRect();
      const target = window.scrollY + rect.top - headerHeight - 8;

      window.scrollTo({ top: target, behavior: 'smooth' });
    };

    // On initial load, if there's a hash, scroll to it after a short delay
    if (typeof window !== 'undefined' && window.location.hash) {
      const id = window.location.hash;
      // allow initial rendering and any automatic scroll-to-top to finish
      setTimeout(() => scrollToHash(id), 120);
    }

    // Listen to hash changes (e.g., user clicks anchor links)
    const onHashChange = () => scrollToHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);

    return () => window.removeEventListener('hashchange', onHashChange);
  }, [pathname]);

  return null;
}
