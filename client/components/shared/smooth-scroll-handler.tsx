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

    // NOTE: Do NOT auto-scroll on initial load even if URL has a hash.
    // This ensures a refresh always starts at the hero section.

    // Listen to hash changes (e.g., user clicks anchor links)
    const onHashChange = () => scrollToHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);

    // Intercept in-page anchor clicks so we can animate and update history
    const onDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest('a') as HTMLAnchorElement | null;
      if (!anchor || !anchor.getAttribute) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Only handle same-page anchors like "#pricing" or "./#pricing" or current pathname + hash
      if (href.startsWith('#') || href.includes(window.location.pathname + '#')) {
        e.preventDefault();
        const hash = href.startsWith('#') ? href : '#' + href.split('#').pop();

        // Update URL without causing a full navigation
        history.pushState(null, '', hash);

        // Smooth scroll to the target
        scrollToHash(hash);
      }
    };

    document.addEventListener('click', onDocumentClick);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      document.removeEventListener('click', onDocumentClick);
    };
  }, [pathname]);

  return null;
}
