export async function loadRecaptcha(siteKey: string) {
  if (typeof window === "undefined") return;
  if ((window as any).grecaptcha && (window as any).grecaptcha.execute) return;

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

export async function executeRecaptcha(action: string) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) {
    // If no site key is configured, skip gracefully (useful for local/dev)
    // Return null to indicate no token was generated
    return null;
  }

  await loadRecaptcha(siteKey);

  if (!(window as any).grecaptcha || !(window as any).grecaptcha.execute) {
    throw new Error("reCAPTCHA not loaded");
  }

  return (window as any).grecaptcha.execute(siteKey, { action });
}
