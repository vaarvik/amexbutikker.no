import 'reflect-metadata';
import { createHash, webcrypto } from 'node:crypto';
import * as x509 from '@peculiar/x509';
import { encode } from 'cbor-x';

x509.cryptoProvider.set(webcrypto as unknown as Parameters<typeof x509.cryptoProvider.set>[0]);

const ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' } as const;
export const NOT_BEFORE = new Date('2026-01-01T00:00:00.000Z');
export const NOT_AFTER = new Date('2027-01-01T00:00:00.000Z');
export const APP_ID = 'ABCDE12345.no.amexbutikker.app';
export const CHALLENGE = 'c1.1794144418.bm9uY2U.c2lnbmF0dXJl';

export interface AppAttestFixtureOptions {
  readonly appId?: string;
  readonly counter?: number;
  readonly aaguid?: Buffer;
  /** The challenge hashed into the certificate's nonce. */
  readonly signedChallenge?: string;
  /** Replace the credential id in authData. */
  readonly credentialId?: Buffer;
}

function sha256(data: Buffer | string): Buffer {
  return createHash('sha256').update(data).digest();
}

type KeyPair = webcrypto.CryptoKeyPair;

async function keys(): Promise<KeyPair> {
  return webcrypto.subtle.generateKey(ALGORITHM, true, ['sign', 'verify']);
}

/** A self-signed root that can sign intermediates. */
export async function testRoot(name = 'Test App Attest Root') {
  const rootKeys = await keys();
  const cert = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: '01',
    name: `CN=${name}`,
    notBefore: NOT_BEFORE,
    notAfter: NOT_AFTER,
    keys: rootKeys,
    signingAlgorithm: ALGORITHM,
    extensions: [
      new x509.BasicConstraintsExtension(true, undefined, true),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.keyCertSign, true),
    ],
  });
  return { cert, keys: rootKeys };
}

/**
 * An attestation object built the way Apple builds one: credential certificate with the nonce
 * extension, signed by an intermediate, signed by `root`.
 */
export async function appAttestFixture(
  root: Awaited<ReturnType<typeof testRoot>>,
  options: AppAttestFixtureOptions = {},
) {
  const intermediateKeys = await keys();
  const intermediate = await x509.X509CertificateGenerator.create({
    serialNumber: '02',
    subject: 'CN=Test App Attest CA 1',
    issuer: root.cert.subject,
    notBefore: NOT_BEFORE,
    notAfter: NOT_AFTER,
    publicKey: intermediateKeys.publicKey,
    signingKey: root.keys.privateKey,
    signingAlgorithm: ALGORITHM,
    extensions: [
      new x509.BasicConstraintsExtension(true, 0, true),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.keyCertSign, true),
    ],
  });

  const credentialKeys = await keys();
  const point = Buffer.from(await webcrypto.subtle.exportKey('raw', credentialKeys.publicKey));
  const keyId = sha256(point);
  const credentialId = options.credentialId ?? keyId;
  const counter = Buffer.alloc(4);
  counter.writeUInt32BE(options.counter ?? 0);
  const idLength = Buffer.alloc(2);
  idLength.writeUInt16BE(credentialId.length);
  const authData = Buffer.concat([
    sha256(options.appId ?? APP_ID),
    Buffer.from([0x40]),
    counter,
    options.aaguid ?? Buffer.concat([Buffer.from('appattest'), Buffer.alloc(7)]),
    idLength,
    credentialId,
  ]);
  const nonce = sha256(Buffer.concat([authData, sha256(options.signedChallenge ?? CHALLENGE)]));

  const leaf = await x509.X509CertificateGenerator.create({
    serialNumber: '03',
    subject: `CN=${keyId.toString('hex')}`,
    issuer: intermediate.subject,
    notBefore: NOT_BEFORE,
    notAfter: NOT_AFTER,
    publicKey: credentialKeys.publicKey,
    signingKey: intermediateKeys.privateKey,
    signingAlgorithm: ALGORITHM,
    extensions: [
      new x509.Extension(
        '1.2.840.113635.100.8.2',
        false,
        Buffer.concat([Buffer.from('3024a1220420', 'hex'), nonce]),
      ),
    ],
  });

  const attestationObject = Buffer.from(
    encode({
      fmt: 'apple-appattest',
      attStmt: {
        x5c: [Buffer.from(leaf.rawData), Buffer.from(intermediate.rawData)],
        receipt: Buffer.from('receipt'),
      },
      authData,
    }),
  ).toString('base64');

  return {
    rootPem: root.cert.toString('pem'),
    input: { keyId: keyId.toString('base64'), attestationObject, challenge: CHALLENGE },
  };
}
