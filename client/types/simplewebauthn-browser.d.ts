declare module '@simplewebauthn/browser' {
  /** Returns true if the current browser supports WebAuthn (platform or roaming) */
  export function browserSupportsWebAuthn(): boolean;

  /**
   * Prompt the browser to create a new credential. The shape here is intentionally loose
   * because different library versions and environments may return different structures.
   */
  export function startRegistration(opts: { optionsJSON: any }): Promise<any>;

  /**
   * Prompt the browser to get an assertion for authentication. Returns credential/assertion.
   */
  export function startAuthentication(opts: { optionsJSON: any }): Promise<any>;

  // Allow importing the module as a namespace/default as well
  const _default: {
    browserSupportsWebAuthn: typeof browserSupportsWebAuthn;
    startRegistration: typeof startRegistration;
    startAuthentication: typeof startAuthentication;
  };
  export default _default;
}
