import { describe, expect, it } from "vitest";
import { parseBearerToken, readAalClaim, bearerStepUpRequired } from "../bearer";

// Jeton d'accès Supabase FACTICE (non signé : la signature est vérifiée côté
// serveur Auth via getUser(jeton), jamais ici). Seule la charge utile compte.
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.signature`;
}

describe("parseBearerToken — en-tête Authorization", () => {
  it("extrait le jeton d'un en-tête « Bearer <jwt> »", () => {
    const jwt = fakeJwt({ sub: "u1" });
    expect(parseBearerToken(`Bearer ${jwt}`)).toBe(jwt);
  });

  it("schéma insensible à la casse, espaces tolérés", () => {
    const jwt = fakeJwt({ sub: "u1" });
    expect(parseBearerToken(`  bearer   ${jwt}  `)).toBe(jwt);
  });

  it("en-tête absent, vide ou d'un autre schéma → null", () => {
    expect(parseBearerToken(null)).toBeNull();
    expect(parseBearerToken(undefined)).toBeNull();
    expect(parseBearerToken("")).toBeNull();
    expect(parseBearerToken("Bearer")).toBeNull();
    expect(parseBearerToken("Bearer ")).toBeNull();
    expect(parseBearerToken("Basic dXNlcjpwYXNz")).toBeNull();
  });

  it("rejette ce qui n'a pas la forme d'un JWT (3 segments base64url)", () => {
    expect(parseBearerToken("Bearer pas-un-jwt")).toBeNull();
    expect(parseBearerToken("Bearer a.b")).toBeNull();
    expect(parseBearerToken("Bearer a.b.c.d")).toBeNull();
    expect(parseBearerToken("Bearer a b.c.d")).toBeNull();
  });

  it("rejette un jeton démesuré (> 4096 caractères) sans le décoder", () => {
    const huge = `${"a".repeat(2000)}.${"b".repeat(2000)}.${"c".repeat(2000)}`;
    expect(parseBearerToken(`Bearer ${huge}`)).toBeNull();
  });
});

describe("readAalClaim — niveau d'assurance porté par le jeton", () => {
  it("lit aal1 / aal2 dans la charge utile", () => {
    expect(readAalClaim(fakeJwt({ sub: "u1", aal: "aal1" }))).toBe("aal1");
    expect(readAalClaim(fakeJwt({ sub: "u1", aal: "aal2" }))).toBe("aal2");
  });

  it("claim absent, valeur inconnue ou charge illisible → null", () => {
    expect(readAalClaim(fakeJwt({ sub: "u1" }))).toBeNull();
    expect(readAalClaim(fakeJwt({ sub: "u1", aal: "aal9" }))).toBeNull();
    expect(readAalClaim("x.%%%.y")).toBeNull();
    expect(readAalClaim("pas-un-jwt")).toBeNull();
  });
});

describe("bearerStepUpRequired — même exigence que le web (proxy.ts)", () => {
  const verified = { factors: [{ status: "verified" }] };
  const unverifiedOnly = { factors: [{ status: "unverified" }] };

  it("compte SANS 2FA : aal1 suffit (jamais de blocage en boucle)", () => {
    expect(bearerStepUpRequired(fakeJwt({ aal: "aal1" }), { factors: [] })).toBe(false);
    expect(bearerStepUpRequired(fakeJwt({ aal: "aal1" }), {})).toBe(false);
    expect(bearerStepUpRequired(fakeJwt({ aal: "aal1" }), unverifiedOnly)).toBe(false);
  });

  it("compte AVEC 2FA active : un jeton aal1 est refusé, un jeton aal2 passe", () => {
    expect(bearerStepUpRequired(fakeJwt({ aal: "aal1" }), verified)).toBe(true);
    expect(bearerStepUpRequired(fakeJwt({ aal: "aal2" }), verified)).toBe(false);
  });

  it("fail-closed : 2FA active mais niveau illisible dans le jeton → refus", () => {
    expect(bearerStepUpRequired(fakeJwt({ sub: "u1" }), verified)).toBe(true);
    expect(bearerStepUpRequired("illisible", verified)).toBe(true);
  });
});
