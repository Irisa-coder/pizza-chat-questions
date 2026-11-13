import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { isHost } from "../lib/host-access";

const worker = {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const pathname = new URL(request.url).pathname;
    if (env.PIZZA_STANDALONE === "1" &&
      (/^\/host\/?$/.test(pathname) || pathname.startsWith("/api/host/"))) {
      const headers = { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" };
      if (!env.PIZZA_HOST_PASSWORD) {
        return new Response("请先设置主持人密码。", { status: 503, headers });
      }
      if (!isHost(request, env)) {
        return new Response("请登录主持人后台。", {
          status: 401,
          headers: { ...headers, "WWW-Authenticate": 'Basic realm="Pizza Chat Host", charset="UTF-8"' },
        });
      }
    }

    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
