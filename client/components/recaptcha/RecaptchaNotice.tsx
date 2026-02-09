"use client";

import Link from "next/link";

export default function RecaptchaNotice() {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) return null;

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
