const RECAPTCHA_LOAD_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch((err) => reject(err))
      .finally(() => clearTimeout(timer));
  });
}

export async function loadRecaptcha(siteKey: string) {
  if (typeof window === "undefined") return;
  if ((window as any).grecaptcha && (window as any).grecaptcha.execute) return;

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src*="recaptcha/api.js?render=${siteKey}"]`,
  );
  if (existing) {
    return withTimeout(
      new Promise<void>((resolve, reject) => {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("reCAPTCHA script failed to load")),
          { once: true },
        );
      }),
      RECAPTCHA_LOAD_TIMEOUT_MS,
      "reCAPTCHA script load timed out",
    );
  }

  return withTimeout(
    new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("reCAPTCHA script failed to load"));
      document.head.appendChild(script);
    }),
    RECAPTCHA_LOAD_TIMEOUT_MS,
    "reCAPTCHA script load timed out",
  );
}

export async function executeRecaptcha(action: string) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const enabled = process.env.NEXT_PUBLIC_RECAPTCHA_ENABLED;

  // Allow explicit env toggle to disable reCAPTCHA in local/dev environments
  if (enabled && enabled.toLowerCase() === 'false') {
    return null;
  }

  // Placeholder value in `.env` should never trigger a real script load.
  if (siteKey && /your_recaptcha_site_key_here/i.test(siteKey)) {
    return null;
  }

  if (!siteKey) {
    // If no site key is configured, skip gracefully (useful for local/dev)
    // Return null to indicate no token was generated
    return null;
  }

  await loadRecaptcha(siteKey);

  if (!(window as any).grecaptcha || !(window as any).grecaptcha.execute) {
    throw new Error("reCAPTCHA not loaded");
  }

  return withTimeout(
    (window as any).grecaptcha.execute(siteKey, { action }),
    RECAPTCHA_LOAD_TIMEOUT_MS,
    "reCAPTCHA execute timed out",
  );
}
