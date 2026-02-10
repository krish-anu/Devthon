declare module '@supabase/supabase-js' {
  export function createClient(url: string, key: string, opts?: any): any;
  export type SupabaseClient = any;
}

declare module 'pg' {
  export class Pool {
    constructor(opts?: any);
    connect(): any;
    query(queryText: string, params?: any[]): Promise<any>;
    end(): Promise<void>;
  }
}

declare module '@simplewebauthn/server' {
  export function verifyAuthenticationResponse(opts: any): any;
  export function verifyRegistrationResponse(opts: any): any;
  export function generateRegistrationOptions(opts: any): any;
  export function generateAuthenticationOptions(opts: any): any;
  export default {
    verifyAuthenticationResponse: verifyAuthenticationResponse,
    verifyRegistrationResponse: verifyRegistrationResponse,
    generateRegistrationOptions: generateRegistrationOptions,
    generateAuthenticationOptions: generateAuthenticationOptions,
  };
}

declare module 'web-push' {
  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string | Buffer,
    options?: any,
  ): Promise<any>;
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };
}
