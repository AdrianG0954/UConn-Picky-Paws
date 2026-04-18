import {
  importJWK,
  SignJWT,
  type JWK,
  type JWTPayload,
  type KeyLike,
} from "npm:jose@6.1.0";
import { XMLParser } from "npm:fast-xml-parser@5.3.0";
import { HttpError } from "./http.ts";
import { getJwtVerificationClient } from "./supabase.ts";

const CAS_BASE = "https://login.uconn.edu/cas";
const DEV_CAS_CALLBACK_URL = "http://localhost:5173/callback";
const JWT_ALGORITHM = "ES256";
const JWT_EXPIRE_MINUTES = Number(
  Deno.env.get("ACCESS_TOKEN_EXPIRE_MINUTES") ?? "30",
);

type CasIdentity = {
  netid: string;
};

type AuthenticatedJwtPayload = JWTPayload & {
  aud: string;
  email: string;
  netid: string;
  role: "authenticated";
  sub: string;
};

let cachedPrivateKey: Promise<KeyLike> | null = null;
let cachedJwtKeyId: string | null | undefined;

function parsePrivateJwkEnv(jwkEnv: string): JWK {
  const parsed = JSON.parse(jwkEnv) as JWK | JWK[];
  const candidate = Array.isArray(parsed) ? parsed[0] : parsed;

  if (!candidate || typeof candidate !== "object") {
    throw new Error("CUSTOM_JWT_PRIVATE_JWK must contain a valid JWK.");
  }

  const { key_ops: _keyOps, use: _use, ext: _ext, ...normalized } = candidate;
  return normalized as JWK;
}

async function importPrivateKey(): Promise<KeyLike> {
  if (cachedPrivateKey) {
    return cachedPrivateKey;
  }

  cachedPrivateKey = (async () => {
    const jwk = Deno.env.get("CUSTOM_JWT_PRIVATE_JWK");
    if (!jwk) {
      throw new Error("Missing custom JWT signing key. Set CUSTOM_JWT_PRIVATE_JWK.");
    }

    return importJWK(parsePrivateJwkEnv(jwk), JWT_ALGORITHM);
  })();

  return cachedPrivateKey;
}

function getJwtKeyId(): string | null {
  if (cachedJwtKeyId !== undefined) {
    return cachedJwtKeyId;
  }

  const privateJwk = Deno.env.get("CUSTOM_JWT_PRIVATE_JWK");
  if (!privateJwk) {
    cachedJwtKeyId = null;
    return cachedJwtKeyId;
  }

  try {
    const parsed = parsePrivateJwkEnv(privateJwk) as { kid?: unknown };
    cachedJwtKeyId =
      typeof parsed.kid === "string" && parsed.kid.trim()
        ? parsed.kid.trim()
        : null;
  } catch {
    cachedJwtKeyId = null;
  }

  return cachedJwtKeyId;
}

async function sha256(input: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function netIdToStableUuid(netid: string): Promise<string> {
  const bytes = await sha256(`uconn-netid:${netid.toLowerCase()}`);
  const uuidBytes = bytes.slice(0, 16);

  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x50;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;

  const hex = bytesToHex(uuidBytes);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function parseCasValidationXml(xml: string): CasIdentity {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: true,
    trimValues: true,
  });

  const document = parser.parse(xml) as {
    serviceResponse?: {
      authenticationFailure?: { code?: string; "#text"?: string } | string;
      authenticationSuccess?: {
        user?: string;
      };
    };
  };

  const response = document.serviceResponse;
  if (!response) {
    throw new HttpError(502, "Invalid CAS validation response.");
  }

  if (response.authenticationFailure) {
    const failure = response.authenticationFailure;
    const code =
      typeof failure === "object" && typeof failure.code === "string"
        ? failure.code
        : "CAS_AUTH_FAILURE";
    const message =
      typeof failure === "string"
        ? failure
        : failure["#text"] ?? "CAS sign-in failed.";
    throw new HttpError(401, `${code}: ${message}`);
  }

  const success = response.authenticationSuccess;
  const netid = success?.user?.trim().toLowerCase();
  if (!netid) {
    throw new HttpError(401, "CAS sign-in failed.");
  }

  return { netid };
}

function getCasServiceUrl(): string {
  const vercelUrl = Deno.env.get("VERCEL_URL")?.trim();
  return vercelUrl ? `https://${vercelUrl}/callback` : DEV_CAS_CALLBACK_URL;
}

export async function validateCasTicket(
  ticket: string,
): Promise<CasIdentity> {
  if (!ticket.trim()) {
    throw new HttpError(400, "Missing CAS ticket.");
  }

  const url = new URL(`${CAS_BASE}/serviceValidate`);
  url.searchParams.set("service", getCasServiceUrl());
  url.searchParams.set("ticket", ticket);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/xml",
    },
  });

  if (!response.ok) {
    throw new HttpError(502, "CAS ticket validation failed.");
  }

  return parseCasValidationXml(await response.text());
}

export async function createAccessToken(identity: CasIdentity): Promise<{
  accessToken: string;
  user: {
    id: string;
    netid: string;
    email: string;
  };
}> {
  const netid = identity.netid.trim().toLowerCase();
  if (!netid) {
    throw new HttpError(400, "NetID is required.");
  }

  const subject = await netIdToStableUuid(netid);
  const email = `${netid}@uconn.edu`;
  const now = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = now + JWT_EXPIRE_MINUTES * 60;
  const signingKey = await importPrivateKey();
  const keyId = getJwtKeyId();
  const protectedHeader: { alg: string; typ: string; kid?: string } = {
    alg: JWT_ALGORITHM,
    typ: "JWT",
  };

  if (keyId) {
    protectedHeader.kid = keyId;
  }

  const accessToken = await new SignJWT({
    aud: "authenticated",
    email,
    netid,
    role: "authenticated",
  })
    .setProtectedHeader(protectedHeader)
    .setSubject(subject)
    .setAudience("authenticated")
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(expiresAtSeconds)
    .setJti(crypto.randomUUID())
    .sign(signingKey);

  return {
    accessToken,
    user: {
      id: subject,
      netid,
      email,
    },
  };
}

function readBearerToken(req: Request): string {
  const header = req.headers.get("authorization");
  if (!header) {
    throw new HttpError(401, "Missing Authorization header.");
  }

  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new HttpError(401, "Authorization header must be a Bearer token.");
  }

  return token;
}

export async function requireAuthenticatedRequest(
  req: Request,
): Promise<AuthenticatedJwtPayload> {
  const token = readBearerToken(req);
  const supabase = getJwtVerificationClient();

  // verifies JWT against server's JSON Web Key Set endpoint /.well-known/jwks.json
  // or signing_keys.json in local dev
  const { data, error } = await supabase.auth.getClaims(token);

  if (error || !data?.claims) {
    console.error("auth: jwt verification failed", error);
    throw new HttpError(401, "Invalid or expired token.");
  }

  const payload = data.claims as Partial<AuthenticatedJwtPayload>;
  if (
    payload.role !== "authenticated" ||
    typeof payload.sub !== "string" ||
    typeof payload.netid !== "string"
  ) {
    throw new HttpError(401, "Token is missing required authentication claims.");
  }

  return payload as AuthenticatedJwtPayload;
}
