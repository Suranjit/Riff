/**
 * Credential and certificate helpers: constant-time comparison for secrets, and
 * self-signed certificate generation with a verifiable fingerprint.
 */

/** A generated TLS certificate + key, with the cert's SHA-256 fingerprint. */
export type SelfSignedCert = {
  cert: string;
  key: string;
  /** `sha256:<hex>` fingerprint of the certificate, for out-of-band verification. */
  fingerprintSha256: string;
};

/**
 * Compare two strings in constant time (length-safe). Returns false for
 * differing lengths without leaking where they differ.
 */
export function constantTimeEquals(_a: string, _b: string): boolean {
  // TODO(#2): implement.
  throw new Error('constantTimeEquals is not implemented yet (#2)');
}

/** SHA-256 fingerprint of a PEM certificate, formatted `sha256:<hex>`. */
export function fingerprintCert(_certPem: string): string {
  // TODO(#2): implement.
  throw new Error('fingerprintCert is not implemented yet (#2)');
}

/** Generate an ephemeral self-signed certificate for local HTTPS/WSS. */
export function generateSelfSignedCert(): SelfSignedCert {
  // TODO(#2): implement.
  throw new Error('generateSelfSignedCert is not implemented yet (#2)');
}
