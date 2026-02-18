"use client";

import Link from "next/link";

export default function RecaptchaNotice() {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const enabled = process.env.NEXT_PUBLIC_RECAPTCHA_ENABLED;
  const isEnabled = !enabled || enabled.toLowerCase() !== "false";
  const hasRealSiteKey =
    !!siteKey && !/your_recaptcha_site_key_here/i.test(siteKey);
  if (!isEnabled || !hasRealSiteKey) return null;

  return (
    <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
      🔒 Protected by reCAPTCHA v3 —{' '}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        Privacy
      </a>{' '}
      &amp;{' '}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        Terms
      </a>
    </p>
  );
}
