import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  try {
    _supabase = createClient(url, anonKey);
    return _supabase;
  } catch (err) {
    console.warn('Supabase init failed', err);
    return null;
  }
}

export function getBucketName() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_BUCKET ||
    'avatars'
  );
}

export function getBookingsBucketName() {
  return process.env.NEXT_PUBLIC_SUPABASE_BOOKINGS_BUCKET || 'bookings';
}

export { getSupabase };
export default getSupabase;