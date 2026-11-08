import { createHash, X509Certificate } from 'node:crypto';
import { ValidationError } from '@amexbutikker/contracts';
import type { AppAttestInput, AppAttestValidator, Clock } from '@amexbutikker/contracts';
import { decode } from 'cbor-x';
import { z } from 'zod';
import type { AppAttestEnvironment } from './devices.model.js';

export interface AppleAppAttestValidatorConfig {
  /** `<Team ID>.<bundle id>` for each build allowed to attest, e.g. `ABCDE12345.no.amexbutikker.app`. */
  readonly appIds: readonly string[];
  /** Apple App Attestation Root CA, PEM. Tests pass their own. */
  readonly rootCertificatePem: string;
  /** Development builds attest with the development AAGUID. */
  readonly environments: readonly AppAttestEnvironment[];
}

/** Apple's OID for the nonce extension in the credential certificate. */
const NONCE_OID = Buffer.from('06092a864886f763640802', 'hex');
/** The extension's value: SEQUENCE { [1] { OCTET STRING (32 bytes) } }. */
const NONCE_PREFIX = Buffer.from('3024a1220420', 'hex');
const AAGUIDS: Readonly<Record<AppAttestEnvironment, Buffer>> = {
  development: Buffer.from('appattestdevelop', 'ascii'),
  production: Buffer.concat([Buffer.from('appattest', 'ascii'), Buffer.alloc(7)]),
};

const AttestationSchema = z.object({
  fmt: z.literal('apple-appattest'),
  attStmt: z.object({
    x5c: z.array(z.instanceof(Uint8Array)).min(2),
    receipt: z.instanceof(Uint8Array),
  }),
  authData: z.instanceof(Uint8Array).refine((data) => data.length >= 55),
});

/**
 * Validates an attestation object as Apple describes in "Validating apps that connect to your
 * server": the certificate chain to the App Attest root, the nonce, the key id, the app id, the
 * counter, the AAGUID and the credential id. The receipt is kept for later fraud-risk checks and
 * not checked here.
 */
export class AppleAppAttestValidator implements AppAttestValidator {
  private readonly root: X509Certificate;
  private readonly appIdHashes: readonly Buffer[];

  public constructor(
    private readonly config: AppleAppAttestValidatorConfig,
    private readonly clock: Clock,
  ) {
    this.root = new X509Certificate(config.rootCertificatePem);
    this.appIdHashes = config.appIds.map((appId) => this.sha256(Buffer.from(appId, 'utf8')));
  }

  public validate(input: AppAttestInput): Promise<void> {
    try {
      this.check(input);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(
        error instanceof ValidationError ? error : this.rejected('could not be read'),
      );
    }
  }

  private check(input: AppAttestInput): void {
    const parsed = AttestationSchema.safeParse(
      decode(Buffer.from(input.attestationObject, 'base64')),
    );
    if (!parsed.success) {
      throw this.rejected('is not an App Attest attestation');
    }
    const { attStmt } = parsed.data;
    const authData = Buffer.from(parsed.data.authData);
    const [leaf, intermediate] = attStmt.x5c.map(
      (der) => new X509Certificate(Buffer.from(der)),
    ) as [X509Certificate, X509Certificate];

    // 1. The chain ends at Apple's App Attest root, and every certificate is valid now.
    const now = this.clock.now();
    const chained =
      leaf.checkIssued(intermediate) &&
      leaf.verify(intermediate.publicKey) &&
      intermediate.checkIssued(this.root) &&
      intermediate.verify(this.root.publicKey);
    const current = [leaf, intermediate, this.root].every(
      (cert) => cert.validFromDate <= now && now <= cert.validToDate,
    );
    if (!chained || !current) {
      throw this.rejected('is not certified by Apple App Attest');
    }

    // 2–4. The nonce in the certificate is SHA-256(authData ‖ SHA-256(challenge)).
    const clientDataHash = this.sha256(Buffer.from(input.challenge, 'utf8'));
    const nonce = this.sha256(Buffer.concat([authData, clientDataHash]));
    if (!nonce.equals(this.nonceIn(Buffer.from(leaf.raw)))) {
      throw this.rejected('does not answer this challenge');
    }

    // 5. The key id is SHA-256 of the certified public key.
    const keyId = Buffer.from(input.keyId, 'base64');
    if (!this.sha256(this.publicKeyPoint(leaf)).equals(keyId)) {
      throw this.rejected('is for another key');
    }

    // 6–9. authData: app id hash, counter 0, AAGUID, credential id.
    const rpIdHash = authData.subarray(0, 32);
    if (!this.appIdHashes.some((hash) => hash.equals(rpIdHash))) {
      throw this.rejected('is for another app');
    }
    if (authData.readUInt32BE(33) !== 0) {
      throw this.rejected('has been used before');
    }
    const aaguid = authData.subarray(37, 53);
    if (!this.config.environments.some((environment) => AAGUIDS[environment].equals(aaguid))) {
      throw this.rejected('is from an environment that is not allowed');
    }
    const credentialIdLength = authData.readUInt16BE(53);
    if (!authData.subarray(55, 55 + credentialIdLength).equals(keyId)) {
      throw this.rejected('names another credential');
    }
  }

  /** The 32-byte nonce in the 1.2.840.113635.100.8.2 extension of the certificate. */
  private nonceIn(der: Buffer): Buffer {
    const oid = der.indexOf(NONCE_OID);
    const value = oid === -1 ? -1 : der.indexOf(NONCE_PREFIX, oid + NONCE_OID.length);
    if (value === -1 || value + NONCE_PREFIX.length + 32 > der.length) {
      throw this.rejected('has no nonce');
    }
    const start = value + NONCE_PREFIX.length;
    return der.subarray(start, start + 32);
  }

  /** The uncompressed EC point `04 ‖ x ‖ y`. */
  private publicKeyPoint(cert: X509Certificate): Buffer {
    const jwk = cert.publicKey.export({ format: 'jwk' });
    if (jwk.x === undefined || jwk.y === undefined) {
      throw this.rejected('has no EC key');
    }
    return Buffer.concat([
      Buffer.from([4]),
      Buffer.from(jwk.x, 'base64url'),
      Buffer.from(jwk.y, 'base64url'),
    ]);
  }

  private sha256(data: Buffer): Buffer {
    return createHash('sha256').update(data).digest();
  }

  private rejected(reason: string): ValidationError {
    return new ValidationError('The App Attest attestation was rejected.', [
      { path: ['attestationObject'], message: reason },
    ]);
  }
}
