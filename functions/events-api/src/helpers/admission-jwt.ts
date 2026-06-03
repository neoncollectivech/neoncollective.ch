import {
  exportJWK,
  generateKeyPair,
  importJWK,
  jwtVerify,
  SignJWT,
  type CryptoKey,
  type JWK,
} from "jose";

import { ADMISSION_JWT_AUD, ADMISSION_JWT_ISS } from "../config/admission";

export type AdmissionJwtClaims = {
  sub: string;
  jti: string;
  iss: string;
  aud: string;
  evt: string;
  ord: string;
  tir: string[];
  iat?: number;
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

export function admissionKidForEvent(eventId: string): string {
  return `event-${eventId}`;
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
  eventId: string;
  orderId: string;
  tierIds: string[];
  kid: string;
  privateJwk: JWK;
}): Promise<string> {
  const privateKey = await importPrivateKey(params.privateJwk);
  const tir = [...new Set(params.tierIds)].sort();

  return new SignJWT({
    jti: params.admissionId,
    evt: params.eventId,
    ord: params.orderId,
    tir,
  })
    .setProtectedHeader({ alg: "EdDSA", kid: params.kid, typ: "JWT" })
    .setSubject(params.admissionId)
    .setIssuer(ADMISSION_JWT_ISS)
    .setAudience(ADMISSION_JWT_AUD)
    .setIssuedAt()
    .sign(privateKey);
}

export type VerifiedAdmissionCredential = {
  admissionId: string;
  eventId: string;
  orderId: string;
  tierIds: string[];
};

export async function verifyAdmissionCredential(params: {
  credential: string;
  kid: string;
  publicJwk: JWK;
  expectedEventId?: string;
}): Promise<VerifiedAdmissionCredential | null> {
  try {
    const publicKey = await importPublicKey(params.publicJwk);
    const { payload, protectedHeader } = await jwtVerify(params.credential, publicKey, {
      issuer: ADMISSION_JWT_ISS,
      audience: ADMISSION_JWT_AUD,
      algorithms: ["EdDSA"],
    });

    if (protectedHeader.kid !== params.kid) {
      return null;
    }

    const admissionId = typeof payload.sub === "string" ? payload.sub : null;
    const eventId = typeof payload.evt === "string" ? payload.evt : null;
    const orderId = typeof payload.ord === "string" ? payload.ord : null;
    const tirRaw = payload.tir;

    if (!admissionId || !eventId || !orderId || !Array.isArray(tirRaw)) {
      return null;
    }

    const tierIds = tirRaw.filter((id): id is string => typeof id === "string");

    if (params.expectedEventId && eventId !== params.expectedEventId) {
      return null;
    }

    return { admissionId, eventId, orderId, tierIds };
  } catch {
    return null;
  }
}
