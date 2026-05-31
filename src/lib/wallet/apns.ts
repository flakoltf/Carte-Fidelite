import http2 from "node:http2";
import fs from "node:fs/promises";
import path from "node:path";

export function buildApnsRequest(pushToken: string, passTypeId: string): {
  path: string; headers: Record<string, string>; body: string;
} {
  return {
    path: `/3/device/${pushToken}`,
    headers: { "apns-topic": passTypeId, "apns-push-type": "background", "apns-priority": "5" },
    body: "{}",
  };
}

async function loadPem(envB64: string | undefined, fileRelPath: string): Promise<Buffer> {
  if (envB64 && envB64.trim().length > 0) return Buffer.from(envB64, "base64");
  return fs.readFile(path.join(process.cwd(), fileRelPath));
}

// Ping APNs vide ("ta carte a changé"). Auth TLS = certificat Pass Type ID existant.
export async function sendPush(pushTokens: string[], passTypeId: string): Promise<{ ok: number; dead: string[] }> {
  if (!pushTokens.length) return { ok: 0, dead: [] };
  const [cert, key] = await Promise.all([
    loadPem(process.env.SIGNER_CERT_BASE64, process.env.SIGNER_CERT_PATH || "certs/signerCert.pem"),
    loadPem(process.env.SIGNER_KEY_BASE64, process.env.SIGNER_KEY_PATH || "certs/signerKey.pem"),
  ]);
  const passphrase = process.env.SIGNER_KEY_PASSPHRASE || "";
  const host = process.env.APNS_HOST || "https://api.push.apple.com";
  const client = http2.connect(host, { cert, key, passphrase });

  let ok = 0;
  const dead: string[] = [];
  await Promise.all(pushTokens.map((tok) => new Promise<void>((resolve) => {
    const r = buildApnsRequest(tok, passTypeId);
    const reqStream = client.request({ ":method": "POST", ":path": r.path, ...r.headers });
    let status = 0;
    reqStream.on("response", (h) => { status = Number(h[":status"]); });
    reqStream.setEncoding("utf8");
    reqStream.on("data", () => {});
    reqStream.on("end", () => { if (status === 200) ok++; else if (status === 410) dead.push(tok); resolve(); });
    reqStream.on("error", () => resolve());
    reqStream.end(r.body);
  })));
  client.close();
  return { ok, dead };
}
