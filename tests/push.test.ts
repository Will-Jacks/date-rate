import { execFileSync } from "node:child_process";
import { createECDH, randomBytes } from "node:crypto";
import fs from "node:fs";
import type http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateVAPIDKeys } from "web-push";

/**
 * Envia notificações de verdade (criptografia aes128gcm + assinatura VAPID)
 * para um "serviço de push" falso rodando localmente.
 */
let server: https.Server;
let base = "";
const received: { url: string; headers: http.IncomingHttpHeaders; size: number }[] = [];

beforeAll(async () => {
  const k = generateVAPIDKeys();
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = k.publicKey;
  process.env.VAPID_PRIVATE_KEY = k.privateKey;
  // a biblioteca só envia por HTTPS: sobe o servidor falso com um certificado temporário
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "push-test-"));
  const key = path.join(dir, "key.pem");
  const cert = path.join(dir, "cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=127.0.0.1"], { stdio: "ignore" });
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      received.push({ url: req.url!, headers: req.headers, size: Buffer.concat(chunks).length });
      res.statusCode = req.url!.includes("gone") ? 410 : 201;
      res.end();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => server.close());

function fakeSub(id: string, path: string) {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    id,
    endpoint: `${base}/${path}`,
    p256dh: ecdh.getPublicKey().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
}

describe("envio de push", () => {
  it("criptografa, assina e remove inscrições expiradas", async () => {
    const { sendToUsers } = await import("@/lib/server/push");
    const subs = [fakeSub("s1", "ok-device"), fakeSub("s2", "gone-device")];
    const deleted: string[][] = [];
    // imita o cliente do Supabase só no que sendToUsers usa
    const admin = {
      from: () => ({
        select: () => ({ in: async () => ({ data: subs, error: null }) }),
        delete: () => ({
          in: async (_col: string, ids: string[]) => {
            deleted.push(ids);
            return { error: null };
          },
        }),
      }),
    };

    const sent = await sendToUsers(admin as never, ["u1"], { title: "💌 Bia avaliou Mangai", body: "Vem ver!", url: "/dates/1", tag: "rated-1" });

    expect(sent).toBe(1);
    expect(received).toHaveLength(2);
    const ok = received.find((r) => r.url === "/ok-device")!;
    expect(ok.headers["content-encoding"]).toBe("aes128gcm");
    expect(String(ok.headers.authorization)).toMatch(/^vapid t=.+, k=.+/);
    expect(ok.headers.urgency).toBe("high");
    expect(ok.size).toBeGreaterThan(60); // corpo criptografado
    expect(deleted).toEqual([["s2"]]);
  });
});
