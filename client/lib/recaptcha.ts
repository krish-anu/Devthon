let recaptchaLoadPromise: Promise<void> | null = null;
const SCRIPT_LOAD_TIMEOUT_MS = 12_000;
const RECAPTCHA_HOSTS = ["https://www.google.com", "https://www.recaptcha.net"] as const;

type RecaptchaExecute = (
  siteKey: string,
  options: { action: string },
) => Promise<string>;

type RecaptchaClient = {
  ready?: (cb: () => void) => void;
  execute?: RecaptchaExecute;
  enterprise?: {
    ready?: (cb: () => void) => void;
    execute?: RecaptchaExecute;
  };
};

function getGrecaptcha(): RecaptchaClient | undefined {
  return (window as Window & { grecaptcha?: RecaptchaClient }).grecaptcha;
}

function hasExecute() {
  const grecaptcha = getGrecaptcha();
  return Boolean(grecaptcha?.execute || grecaptcha?.enterprise?.execute);
}

function waitForRecaptchaReady(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const doneOrRetry = () => {
      if (hasExecute()) {
        resolve();
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        reject(new Error("reCAPTCHA not loaded"));
        return;
      }

      setTimeout(check, 50);
    };

    const check = () => {
      const grecaptcha = getGrecaptcha();
      if (!grecaptcha) {
        doneOrRetry();
        return;
      }

      const readyFn = grecaptcha.ready ?? grecaptcha.enterprise?.ready;
      if (typeof readyFn === "function") {
        try {
          readyFn(() => doneOrRetry());
          return;
        } catch {
          doneOrRetry();
          return;
        }
      }

      doneOrRetry();
    };

    check();
  });
}

function buildRecaptchaSrc(siteKey: string, host: (typeof RECAPTCHA_HOSTS)[number]) {
  return `${host}/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
}

function removeRecaptchaScripts() {
  document
    .querySelectorAll<HTMLScriptElement>(
      'script[src*="/recaptcha/api.js"], script[src*="/recaptcha/enterprise.js"]',
    )
    .forEach((script) => script.remove());
}

/**
 * Unload reCAPTCHA completely: remove script tags, badge UI and detach window.grecaptcha.
 * Call this when navigating away from auth pages so the badge doesn't persist globally.
 */
export function unloadRecaptcha() {
  if (typeof window === "undefined") return;
  // remove the badge node(s) injected by Google
  document.querySelectorAll<HTMLElement>(".grecaptcha-badge").forEach((el) => el.remove());
  // remove any recaptcha script tags
  removeRecaptchaScripts();
  // attempt to clear the global grecaptcha reference
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).grecaptcha;
  } catch {}
  // allow future loads
  recaptchaLoadPromise = null;
}

function injectRecaptchaScript(src: string, timeoutMs = SCRIPT_LOAD_TIMEOUT_MS) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;

    const cleanup = () => {
      script.onload = null;
      script.onerror = null;
      window.clearTimeout(timeoutId);
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    const timeoutId = window.setTimeout(() => {
      script.remove();
      finish(new Error("Timed out loading reCAPTCHA script"));
    }, timeoutMs);

    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => finish();
    script.onerror = () => finish(new Error(`Failed to load reCAPTCHA script: ${src}`));
    document.head.appendChild(script);
  });
}

export async function loadRecaptcha(siteKey: string) {
  if (typeof window === "undefined") return;
  if (hasExecute()) return;

  if (!recaptchaLoadPromise) {
    recaptchaLoadPromise = (async () => {
      // If another script loaded reCAPTCHA already, use it.
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src*="/recaptcha/api.js"], script[src*="/recaptcha/enterprise.js"]',
      );
      if (existingScript) {
        try {
          await waitForRecaptchaReady(1500);
          if (hasExecute()) {
            return;
          }
        } catch {
          // Stale script tag; continue with clean retries below.
        }
      }

      const errors: string[] = [];

      for (const host of RECAPTCHA_HOSTS) {
        try {
          removeRecaptchaScripts();
          await injectRecaptchaScript(buildRecaptchaSrc(siteKey, host));
          await waitForRecaptchaReady();
          if (hasExecute()) return;
          throw new Error("reCAPTCHA execute API unavailable");
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`${host}: ${message}`);
        }
      }

      throw new Error(`reCAPTCHA not loaded (${errors.join(" | ")})`);
    })().catch((err) => {
      recaptchaLoadPromise = null;
      throw err;
    });
  }

  await recaptchaLoadPromise;
}

export async function executeRecaptcha(action: string) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const enabled = process.env.NEXT_PUBLIC_RECAPTCHA_ENABLED;
  const nodeEnv = process.env.NODE_ENV;
  const isProduction = nodeEnv === "production";

  // Allow explicit env toggle to disable reCAPTCHA in local/dev environments
  if (enabled && enabled.toLowerCase() === "false") {
    return null;
  }

  // Placeholder value in `.env` should never trigger a real script load.
  if (siteKey && /your_recaptcha_site_key_here/i.test(siteKey)) {
    if (isProduction) {
      throw new Error("reCAPTCHA is misconfigured: placeholder site key in production build");
    }
    return null;
  }

  if (!siteKey) {
    // In production, missing site key is always a deployment/config issue.
    if (isProduction) {
      throw new Error("reCAPTCHA is misconfigured: missing NEXT_PUBLIC_RECAPTCHA_SITE_KEY");
    }
    // If no site key is configured, skip gracefully in local/dev.
    return null;
  }

  await loadRecaptcha(siteKey);

  const grecaptcha = getGrecaptcha();
  if (grecaptcha?.execute) {
    return grecaptcha.execute(siteKey, { action });
  }
  if (grecaptcha?.enterprise?.execute) {
    return grecaptcha.enterprise.execute(siteKey, { action });
  }

  throw new Error("reCAPTCHA not loaded");
}
