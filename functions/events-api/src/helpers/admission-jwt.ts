import {
  exportJWK,
  generateKeyPair,
  importJWK,
  jwtVerify,
  SignJWT,
  type CryptoKey,
  type JWK,
} from "jose";

import {
  ADMISSION_JWT_AUD,
  ADMISSION_JWT_CLOCK_TOLERANCE_SEC,
  ADMISSION_JWT_ISS,
} from "../config/admission";

/** Compact JWT payload: only `sub` (admission id); event/order/tiers live in DB. */
export type AdmissionJwtClaims = {
  sub: string;
  iss: string;
  aud: string;
  iat?: number;
  exp?: number;
};

export type AdmissionSigningMaterial = {
  kid: string;
  publicJwk: JWK;
  privateJwk: JWK;
};

export async function generateEd25519AdmissionKeyPair(): Promise<AdmissionSigningMaterial> {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", {
    crv: "Ed25519",
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);

  publicJwk.alg = "EdDSA";
  privateJwk.alg = "EdDSA";

  return {
    kid: crypto.randomUUID(),
    publicJwk,
    privateJwk,
  };
}

/** Short JWKS `kid` (~23 chars) instead of `event-{uuid}`. */
export function admissionKidForEvent(eventId: string): string {
  const hex = eventId.replace(/-/g, "");
  const bytes = new Uint8Array(16);

  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return `e${Buffer.from(bytes).toString("base64url")}`;
}

async function importPrivateKey(jwk: JWK): Promise<CryptoKey> {
  return (await importJWK(jwk, "EdDSA")) as CryptoKey;
}

async function importPublicKey(jwk: JWK): Promise<CryptoKey> {
  const key = await importJWK(jwk, "EdDSA");

  if (!key) {
    throw new Error("Admission public JWK could not be imported.");
  }

  return key as CryptoKey;
}

export async function signAdmissionCredential(params: {
  admissionId: string;
  kid: string;
  privateJwk: JWK;
  expiresAt: Date;
}): Promise<string> {
  const privateKey = await importPrivateKey(params.privateJwk);

  return new SignJWT({})
    .setProtectedHeader({ alg: "EdDSA", kid: params.kid })
    .setSubject(params.admissionId)
    .setIssuer(ADMISSION_JWT_ISS)
    .setAudience(ADMISSION_JWT_AUD)
    .setIssuedAt()
    .setExpirationTime(Math.floor(params.expiresAt.getTime() / 1000))
    .sign(privateKey);
}

export type VerifiedAdmissionCredential = {
  admissionId: string;
};

export async function verifyAdmissionCredential(params: {
  credential: string;
  kid: string;
  publicJwk: JWK;
}): Promise<VerifiedAdmissionCredential | null> {
  try {
    const publicKey = await importPublicKey(params.publicJwk);
    const { payload, protectedHeader } = await jwtVerify(params.credential, publicKey, {
      issuer: ADMISSION_JWT_ISS,
      audience: ADMISSION_JWT_AUD,
      algorithms: ["EdDSA"],
      clockTolerance: ADMISSION_JWT_CLOCK_TOLERANCE_SEC,
    });

    if (protectedHeader.kid !== params.kid) {
      return null;
    }

    const admissionId = typeof payload.sub === "string" ? payload.sub : null;

    if (!admissionId) {
      return null;
    }

    return { admissionId };
  } catch {
    return null;
  }
}
