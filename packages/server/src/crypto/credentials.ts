/**
 * Credential and certificate helpers: constant-time comparison for secrets, and
 * self-signed certificate generation with a verifiable fingerprint.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import selfsigned from 'selfsigned';

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
export function constantTimeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) {
    // Compare against self to keep the timing profile independent of `b`.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/** SHA-256 fingerprint of a PEM certificate, formatted `sha256:<hex>`. */
export function fingerprintCert(certPem: string): string {
  const der = pemToDer(certPem);
  return `sha256:${createHash('sha256').update(der).digest('hex')}`;
}

function pemToDer(certPem: string): Buffer {
  const body = certPem
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\s+/g, '');
  return Buffer.from(body, 'base64');
}

/** Generate an ephemeral self-signed certificate for local HTTPS/WSS. */
export function generateSelfSignedCert(): SelfSignedCert {
  const pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
    days: 1,
    keySize: 2048,
  });
  return {
    cert: pems.cert,
    key: pems.private,
    fingerprintSha256: fingerprintCert(pems.cert),
  };
}
