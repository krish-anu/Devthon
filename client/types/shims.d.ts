declare module '@supabase/supabase-js' {
  export function createClient(url: string, key: string, opts?: any): any;
  export type SupabaseClient = any;
}
