let recaptchaLoadPromise: Promise<void> | null = null;

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

export async function loadRecaptcha(siteKey: string) {
  if (typeof window === "undefined") return;
  if (hasExecute()) return;

  if (!recaptchaLoadPromise) {
    recaptchaLoadPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src^="https://www.google.com/recaptcha/api.js"]',
      );

      const onReady = () => {
        waitForRecaptchaReady().then(resolve).catch(reject);
      };

      if (existingScript) {
        onReady();
        return;
      }

      const script = document.createElement("script");
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.defer = true;
      script.onload = onReady;
      script.onerror = () => reject(new Error("Failed to load reCAPTCHA script"));
      document.head.appendChild(script);
    }).catch((err) => {
      recaptchaLoadPromise = null;
      throw err;
    });
  }

  await recaptchaLoadPromise;
}

export async function executeRecaptcha(action: string) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const enabled = process.env.NEXT_PUBLIC_RECAPTCHA_ENABLED;

  // Allow explicit env toggle to disable reCAPTCHA in local/dev environments
  if (enabled && enabled.toLowerCase() === "false") {
    return null;
  }

  if (!siteKey) {
    // If no site key is configured, skip gracefully (useful for local/dev)
    // Return null to indicate no token was generated
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
