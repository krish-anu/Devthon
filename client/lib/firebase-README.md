Quick notes for Firebase setup

- Add your Firebase web config values to `.env.local` (or your environment):
  - NEXT_PUBLIC_FIREBASE_API_KEY
  - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  - NEXT_PUBLIC_FIREBASE_PROJECT_ID
  - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  - NEXT_PUBLIC_FIREBASE_APP_ID
  - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID (optional)

- The helper `client/lib/firebase.ts` initializes the app and exports `auth`, `db`, `storage` and optionally `analytics`.
- Import Firebase features only in client code (use dynamic import or inside `useEffect`) to avoid server-side errors in Next.js.
- Do NOT commit private service account keys to the repository. Use server-side environment variables or a secret manager for admin SDK usage.