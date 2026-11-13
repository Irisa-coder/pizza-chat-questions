import { Buffer } from "node:buffer";
import { createHash, timingSafeEqual } from "node:crypto";

export function isHost(request: Request, env: Cloudflare.Env) {
  if (env.PIZZA_STANDALONE === "1") {
    const password = env.PIZZA_HOST_PASSWORD;
    const token = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(request.headers.get("Authorization") ?? "")?.[1];
    if (!password || !token) return false;

    const presented = createHash("sha256").update(Buffer.from(token, "base64")).digest();
    const expected = createHash("sha256").update("host:" + password).digest();
    return timingSafeEqual(presented, expected);
  }

  const expectedEmail = env.PIZZA_HOST_EMAIL;
  if (!expectedEmail || !request.headers.get("oai-authenticated-user-id")) return false;
  const actualEmail = request.headers.get("oai-authenticated-user-email");
  return actualEmail?.toLowerCase() === expectedEmail.toLowerCase();
}
