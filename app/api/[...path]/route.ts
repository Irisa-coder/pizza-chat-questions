import { env } from "cloudflare:workers";
import { isHost } from "../../../lib/host-access";
import { normalizeQuestion, readBoard, readHostState, readMine, readQuestions, resetRound, setOpen, submitQuestion, visitorHash } from "../../../lib/party-store";
import { questionsWorkbook } from "../../../lib/questions-workbook";

export const dynamic = "force-dynamic";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const privateHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" };

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: privateHeaders });
}

function verifyOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.length;
      if (total > 4096) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(next.value, { stream: true });
    }
    const data: unknown = JSON.parse(text + decoder.decode());
    return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function isRound(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value < Number.MAX_SAFE_INTEGER;
}

async function route(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path.startsWith("/api/host/") && !isHost(request, env.PIZZA_HOST_EMAIL)) {
    return json({ error: "请用活动主理人的 ChatGPT 账号登录。" }, 403);
  }
  if (request.method === "POST" && !verifyOrigin(request)) return json({ error: "请在活动页面操作。" }, 403);
  const db = env.DB;
  if (!db) return json({ error: "暂时连不上问题盒，请稍后再试。" }, 503);
  if (request.method === "GET" && path === "/api/board") return json(await readBoard(db));
  if (request.method === "GET" && path === "/api/mine") {
    const device = request.headers.get("x-pizza-device");
    if (!device || !uuidPattern.test(device)) return json({ mine: null });
    return json({ mine: await readMine(db, await visitorHash(device)) });
  }
  if (request.method === "GET" && path === "/api/host/questions") {
    return json(await readHostState(db));
  }
  if (request.method === "GET" && path === "/api/host/export") {
    const selection = url.searchParams.get("round");
    const round = selection === null ? undefined : Number(selection);
    if (round !== undefined && !isRound(round)) return json({ error: "轮次无效。" }, 400);
    const bytes = questionsWorkbook(await readQuestions(db, round));
    const filename = "PizzaChat_Vol01_questions" + (round === undefined ? "" : "_round_" + round) + ".xlsx";
    return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="' + filename + '"',
      },
    });
  }
  if (request.method === "POST" && path === "/api/host/state") {
    const body = await readJson(request);
    if (typeof body?.open !== "boolean") return json({ error: "请选择开启或暂停投稿。" }, 400);
    await setOpen(db, body.open);
    return json(await readBoard(db));
  }
  if (request.method === "POST" && path === "/api/host/reset") {
    const body = await readJson(request);
    if (!isRound(body?.round)) return json({ error: "请刷新后再重置。" }, 400);
    return json(await resetRound(db, body.round));
  }
  if (request.method === "POST" && path === "/api/questions") {
    const body = await readJson(request);
    const device = request.headers.get("x-pizza-device");
    const id = body?.submissionId;
    const question = normalizeQuestion(body?.question);
    const round = body?.round;
    if (!isRound(round)) return json({ error: "请刷新页面后再投稿。", board: await readBoard(db) }, 409);
    if (!device || !uuidPattern.test(device) || typeof id !== "string" || !uuidPattern.test(id) ||
        !question || typeof body?.allowShare !== "boolean") {
      return json({ error: "请写下 3–320 字的问题，再试一次。" }, 400);
    }
    const result = await submitQuestion(db, {
      submissionId: id, hash: await visitorHash(device), question, allowShare: body.allowShare, round,
    });
    if (result.status === "reset") return json({ error: "新一轮已开始，请再点一次提交。", board: result.board }, 409);
    if (result.status === "closed") return json({ error: "投稿已经暂停，谢谢你来拼披萨。" }, 409);
    if (result.status === "limit") return json({ error: "这台设备的投稿已满，谢谢你的问题！" }, 429);
    if (result.status === "conflict") return json({ error: "这次提交已保存，请重新打开页面后继续。" }, 409);
    return json({ board: result.board, mine: result.mine }, result.inserted ? 201 : 200);
  }
  return json({ error: "这里没有问题盒。" }, 404);
}

export async function GET(request: Request) {
  try { return await route(request); }
  catch { return json({ error: "暂时连不上问题盒，请稍后再试。" }, 503); }
}

export const POST = GET;
