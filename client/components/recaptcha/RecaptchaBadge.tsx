"use client";

export default function RecaptchaBadge() {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const enabled = process.env.NEXT_PUBLIC_RECAPTCHA_ENABLED;
  const isEnabled = !enabled || enabled.toLowerCase() !== "false";
  const hasRealSiteKey =
    !!siteKey && !/your_recaptcha_site_key_here/i.test(siteKey);
  if (!isEnabled || !hasRealSiteKey) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-md bg-white/90 dark:bg-slate-900/80 px-3 py-2 shadow-sm border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200">
      {/* Small inline shield-like SVG as a subtle reCAPTCHA mark */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="flex-shrink-0">
        <rect x="2" y="6" width="20" height="12" rx="2" fill="#edf7ee" />
        <path d="M6 10c1.5 2 3 3 6 6 3-3 4.5-4 6-6" stroke="#34a853" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div className="leading-tight">
        <div className="whitespace-nowrap font-medium">Protected by reCAPTCHA</div>
        <div className="text-[10px] opacity-80">
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="underline mr-1">Privacy</a>
          &amp;
          <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="underline ml-1">Terms</a>
        </div>
      </div>
    </div>
  );
}
