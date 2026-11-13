"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import makeQr from "qrcode-generator";
import { CAPACITY, QUESTION_LIMIT, TOPPINGS, localTime, participantUrl, type BoardState, type MyPiece, type Piece, type Question, type Topping } from "../lib/event";

const EMPTY: BoardState = { pieces: [], count: 0, capacity: CAPACITY, open: true, round: 0 };
const DEVICE_KEY = "pizza-chat-vol01-device";
const RETRY_KEY = "pizza-chat-vol01-retry";
const MAX_REFRESH_MS = 2800;

function browserDevice() {
  let value = localStorage.getItem(DEVICE_KEY);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, value);
  }
  return value;
}

class ApiError extends Error {
  constructor(message: string, readonly board?: BoardState) { super(message); }
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...options });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const message = data && typeof data === "object" && "error" in data ? data.error : null;
    const board = data && typeof data === "object" && "board" in data ? data.board as BoardState : undefined;
    throw new ApiError(typeof message === "string" ? message : "连接中断，请再试一次。", board);
  }
  return data as T;
}

function useBoard(initial: BoardState = EMPTY) {
  const [board, setBoard] = useState(initial);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const changes = useRef(0);
  const updateBoard = useCallback((snapshot: BoardState) => {
    changes.current += 1;
    setBoard(current => snapshot.round >= current.round ? snapshot : current);
    setReady(true);
    setOffline(false);
  }, []);
  useEffect(() => {
    let alive = true;
    let busy = false;
    async function refresh() {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      const previousChange = changes.current;
      try {
        const data = await api<BoardState>("/api/board");
        if (alive && previousChange === changes.current) {
          setBoard(current => data.round >= current.round ? data : current);
          setReady(true);
          setOffline(false);
        }
      } catch {
        if (alive && previousChange === changes.current) setOffline(true);
      } finally { busy = false; }
    }
    void refresh();
    const timer = window.setInterval(refresh, MAX_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return { board, updateBoard, ready, offline };
}

function Header({ right }: { right?: React.ReactNode }) {
  return <header className="site-header">
    <a className="brand" href="/" aria-label="Pizza Chat 投稿入口"><span aria-hidden="true">🍕</span> Pizza Chat</a>
    <span className="edition">Vol.01</span>
    <div className="header-actions">{right}</div>
  </header>;
}

function Footer({ host = true }: { host?: boolean }) {
  return <footer className="site-footer">
    <span>知乎 AI Researcher Club</span>
    {host && <a href="/host">主持人入口</a>}
  </footer>;
}

const W = 420;
const MID = W / 2;
const CRUST_RADIUS = 186;
const INNER_RADIUS = 169;
const STEP = Math.PI * 2 / CAPACITY;
const CIRCLE_PART = STEP / 2 - 0.012;

function sector(index: number, radius: number, centre = 11, gap = CIRCLE_PART) {
  const angle = -Math.PI / 2 + (index + .5) * STEP;
  const p1 = [MID + radius * Math.cos(angle - gap), MID + radius * Math.sin(angle - gap)];
  const p2 = [MID + radius * Math.cos(angle + gap), MID + radius * Math.sin(angle + gap)];
  const p0 = [MID + centre * Math.cos(angle), MID + centre * Math.sin(angle)];
  return "M " + p0.join(" ") + " L " + p1.join(" ") + " A " + radius + " " + radius + " 0 0 1 " + p2.join(" ") + " Z";
}

function Ingredient({ topping, size = 12 }: { topping: Topping; size?: number }) {
  const style = TOPPINGS[topping];
  if (topping === "basil") return <path d="M-6 4 Q-5 -8 7 -6 Q8 6 -6 4 Z" fill={style.color} stroke={style.ink} strokeWidth="1.6"/>;
  if (topping === "mushroom") return <path d="M-7 1 Q-8 -6 -2 -8 Q5 -9 8 -2 Q7 2 2 2 L2 7 L-2 7 L-2 2 Q-5 3 -7 1Z" fill="#F4CEAA" stroke={style.ink} strokeWidth="1.5" strokeLinejoin="round"/>;
  if (topping === "corn" || topping === "pineapple") return <rect x="-5.5" y="-5.5" width="11" height="11" rx={topping === "corn" ? 5 : 2} fill={style.color} stroke={style.ink} strokeWidth="1.5"/>;
  return <circle r={size / 2} fill={style.color} stroke={style.ink} strokeWidth={topping === "olive" ? 3 : 1.6}/>;
}

function Pizza({ pieces, active = 0 }: { pieces: Piece[]; active?: number }) {
  const pieceMap = useMemo(() => new Map(pieces.map(piece => [piece.slot, piece.topping])), [pieces]);
  return <svg className="pizza" viewBox={"0 0 " + W + " " + W} role="img" aria-label={"披萨已拼 " + pieces.length + " / " + CAPACITY + " 块"}>
    <circle cx={MID} cy={MID} r="202" fill="#FFFBF0" stroke="#282320" strokeWidth="2.3"/>
    <circle cx={MID} cy={MID} r="196" fill="none" stroke="#EDDBB2" strokeWidth="1.5" strokeDasharray="2 6"/>
    {Array.from({ length: CAPACITY }, (_, index) => {
      const slot = index + 1;
      const topping = pieceMap.get(slot);
      const style = topping ? TOPPINGS[topping] : null;
      const angle = -Math.PI / 2 + (index + .5) * STEP;
      const degrees = angle * 180 / Math.PI + 90;
      return <g key={slot} className={topping ? "pizza-piece filled" + (active === slot ? " yours" : "") : "pizza-piece"}>
        <path d={sector(index, CRUST_RADIUS)} fill={style ? "#F1A957" : "#FFF5DF"}
          stroke={style ? "#2C2420" : "#D9C498"} strokeWidth={style ? "1.65" : "1.2"} strokeLinejoin="round"/>
        {style && topping ? <>
          <path d={sector(index, INNER_RADIUS, 11, CIRCLE_PART - .013)} fill={style.base} stroke="#D99444" strokeWidth="1.15"/>
          <g transform={"translate(" + MID + " " + MID + ") rotate(" + degrees + ")"}>
            <g transform="translate(-12 -145) rotate(-12)"><Ingredient topping={topping} size={15}/></g>
            <g transform="translate(15 -130) rotate(31)"><Ingredient topping={topping} size={13}/></g>
            <g transform="translate(-7 -104) rotate(75)"><Ingredient topping={topping} size={12}/></g>
            <g transform="translate(5 -77) rotate(-16) scale(.8)"><Ingredient topping={topping} size={11}/></g>
            <circle cx="12" cy="-106" r="2.3" fill="#E68E41"/>
            <circle cx="-10" cy="-62" r="1.6" fill="#E68E41"/>
          </g>
        </> : <circle cx={MID + 134 * Math.cos(angle)} cy={MID + 134 * Math.sin(angle)} r="2.7" fill="#DCCA9D"/>}
      </g>;
    })}
    <circle cx={MID} cy={MID} r="8" fill={pieces.length ? "#FFDF91" : "#FFF7E1"}/>
  </svg>;
}

function Slice({ topping }: { topping: Topping }) {
  const style = TOPPINGS[topping];
  return <svg viewBox="0 0 100 100" className="receipt-slice" aria-hidden="true">
    <path d="M17 25 Q52 5 84 24 L50 87Z" fill={style.base} stroke="#32231C" strokeWidth="3.5" strokeLinejoin="round"/>
    <path d="M17 25 Q52 5 84 24" fill="none" stroke="#E69D54" strokeWidth="8" strokeLinecap="round"/>
    <g transform="translate(40 36)"><Ingredient topping={topping} size={14}/></g>
    <g transform="translate(62 40) rotate(32)"><Ingredient topping={topping} size={12}/></g>
    <g transform="translate(50 58) scale(.88)"><Ingredient topping={topping} size={11}/></g>
  </svg>;
}

function QrCode() {
  const svg = useMemo(() => {
    const code = makeQr(0, "M");
    code.addData(participantUrl);
    code.make();
    return code.createSvgTag({ cellSize: 5, margin: 20, scalable: true });
  }, []);
  return <div className="qr-code" role="img" aria-label="扫描二维码进入匿名提问页面" dangerouslySetInnerHTML={{ __html: svg }}/>;
}

function Status({ board, offline, ready }: { board: BoardState; offline: boolean; ready: boolean }) {
  return <p className="connection" role="status"><span className={offline || !board.open ? "status-dot paused" : "status-dot"}/>
    {offline ? "连接暂时中断，正在重连" : !ready ? "正在连接披萨盒" : board.open ? "现场拼图同步中" : "投稿已暂停"}
  </p>;
}

type Retry = { submissionId: string; question: string; allowShare: boolean; round: number };

function GameTitle() {
  return <h1 className="game-title">把问题<span className="pack">「打包」</span><span className="carry">带走</span></h1>;
}

export function Participant() {
  const { board, updateBoard, ready, offline } = useBoard();
  const [question, setQuestion] = useState("");
  const [allowShare, setAllowShare] = useState(false);
  const [receipt, setReceipt] = useState<MyPiece | null>(null);
  const mine = receipt?.round === board.round ? receipt : null;
  const [lastSubmittedRound, setLastSubmittedRound] = useState(0);
  const saved = lastSubmittedRound === board.round;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const retry = useRef<Retry | null>(null);
  const length = Array.from(question).length;

  useEffect(() => {
    try {
      browserDevice();
      const pending = localStorage.getItem(RETRY_KEY);
      if (pending) {
        const restored: Retry = JSON.parse(pending);
        if (typeof restored.question === "string") {
          retry.current = restored;
          setQuestion(restored.question);
          setAllowShare(restored.allowShare);
        }
      }
    } catch { /* Storage errors are reported when submitting. */ }
  }, []);

  useEffect(() => {
    if (!board.round) return;
    let alive = true;
    try {
      void api<{ mine: MyPiece | null }>("/api/mine", { headers: { "x-pizza-device": browserDevice() } })
        .then(({ mine: savedPiece }) => {
          if (alive && savedPiece?.round === board.round) {
            setReceipt(current => current?.round === board.round ? current : savedPiece);
          }
        }).catch(() => {});
    } catch { /* Storage errors are reported when submitting. */ }
    return () => { alive = false; };
  }, [board.round]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !ready || !board.open) return;
    const clean = question.trim();
    if (Array.from(clean).length < 3 || length > QUESTION_LIMIT) {
      setError("写下 3–320 字的问题就可以投啦。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const device = browserDevice();
      const pending = retry.current;
      const payload = pending?.round === board.round && pending.question === clean && pending.allowShare === allowShare ? pending : {
        submissionId: crypto.randomUUID(), question: clean, allowShare, round: board.round,
      };
      retry.current = payload;
      localStorage.setItem(RETRY_KEY, JSON.stringify(payload));
      const data = await api<{ board: BoardState; mine: MyPiece }>("/api/questions", {
        method: "POST", headers: { "Content-Type": "application/json", "x-pizza-device": device },
        body: JSON.stringify(payload),
      });
      retry.current = null;
      try { localStorage.removeItem(RETRY_KEY); } catch { /* The server has confirmed the submission. */ }
      updateBoard(data.board);
      setReceipt(data.mine);
      setLastSubmittedRound(data.mine.round);
      setQuestion("");
      setAllowShare(false);
    } catch (err) {
      if (err instanceof ApiError && err.board) {
        retry.current = null;
        updateBoard(err.board);
      }
      setError(err instanceof Error && err.name !== "SecurityError" ? err.message : "请用手机浏览器打开链接后再试。");
    } finally { setBusy(false); }
  }

  return <div className="site-shell participant-shell">
    <Header right={<a href="/board">看现场披萨 <span aria-hidden="true">↗</span></a>}/>
    <main className="participant-main">
      <section className="participant-copy">
        <p className="event-label">知乎 AI Researcher Club</p>
        <GameTitle/>
        <p className="hero-copy">今晚没聊完的，带到知乎接着聊。</p>
        <div className="form-surface">
          {mine && <div className="receipt" aria-live="polite">
            <Slice topping={mine.topping}/>
            <div><p className="receipt-title">{saved && !mine.first ? "补充问题已收下" : "你的" + TOPPINGS[mine.topping].name + "披萨"}</p>
              <p>{saved && !mine.first ? "第一块披萨还在原位。" : mine.slot <= CAPACITY ? "你的问题拼出了第 " + mine.slot + " 块。" : "问题已收下，现场拼图已经拼满。"}</p>
            </div>
          </div>}
          {board.open ? <form onSubmit={submit}>
            <label htmlFor="question">今晚你还想问什么？</label>
            <textarea id="question" value={question} onChange={event => setQuestion(Array.from(event.target.value).slice(0, QUESTION_LIMIT).join(""))}
              placeholder="写一个你想听听其他研究者怎么回答的问题" rows={4} required/>
            <div className="under-field"><span>匿名提交，原文仅主持人可见</span><span>{length}/{QUESTION_LIMIT}</span></div>
            <label className="check-label"><input type="checkbox" checked={allowShare} onChange={event => setAllowShare(event.target.checked)}/>
              <span>同意主持人整理后匿名发布到知乎<span className="optional">（选填）</span></span></label>
            <button className="primary-button" type="submit" disabled={busy || !ready}>{busy ? "正在打包…" : mine ? "再投一问" : "投一问，抽披萨"}<span aria-hidden="true">↗</span></button>
            {error && <p className="error" role="alert">{error}</p>}
          </form> : <p className="closed-message">投稿已暂停。谢谢你来拼披萨！</p>}
        </div>
      </section>
      <section className="pizza-side" aria-label="现场披萨">
        <div className="pizza-side-heading"><h2>现场披萨</h2><strong>{board.count}<span> / {CAPACITY}</span></strong></div>
        <Pizza pieces={board.pieces} active={mine?.slot}/>
        <div className="pizza-foot"><span>{board.count >= CAPACITY ? "一张披萨，拼好了！" : "每人首投，点亮一块。"}</span><Status board={board} ready={ready} offline={offline}/></div>
      </section>
    </main>
    <Footer/>
  </div>;
}

export function Board() {
  const { board, ready, offline } = useBoard();
  const [copied, setCopied] = useState(false);
  async function copyLink() {
    try { await navigator.clipboard.writeText(participantUrl); setCopied(true); }
    catch { setCopied(false); }
  }
  return <div className="site-shell board-shell">
    <Header right={<a href="/host">主持人入口 <span aria-hidden="true">↗</span></a>}/>
    <main className="board-main">
      <section className="board-copy">
        <p className="event-label">知乎 AI Researcher Club</p>
        <GameTitle/>
        <p className="hero-copy">今晚没聊完的，<br/>带到知乎接着聊。</p>
        <div className="qr-ticket">
          <a href={participantUrl} target="_blank" rel="noreferrer"><QrCode/></a>
          <div><h2>扫码留一问</h2><p>每人的第一问<br/>会拼上一块随机披萨。</p>
          <button className="text-button" type="button" onClick={copyLink}>{copied ? "链接已复制" : "复制投稿链接"} <span aria-hidden="true">↗</span></button></div>
        </div>
      </section>
      <section className="board-pizza" aria-label="现场拼图进度">
        <div className="board-score"><span>已拼</span> <strong>{String(board.count).padStart(2, "0")}</strong><span> / {CAPACITY} 块</span></div>
        <Pizza pieces={board.pieces}/>
        <p className="board-result" role="status">{board.count >= CAPACITY ? "一张披萨，拼好了！" : "等你来加一块"}</p>
        <Status board={board} ready={ready} offline={offline}/>
      </section>
    </main>
    <Footer host={false}/>
  </div>;
}

export function HostPanel() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [board, setBoard] = useState<BoardState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<"state" | "reset" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [shareOnly, setShareOnly] = useState(false);
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++request.current;
    try {
      const data = await api<{ questions: Question[]; board: BoardState }>("/api/host/questions");
      if (request.current === current) {
        setQuestions(data.questions); setBoard(data.board); setReady(true); setError("");
      }
    } catch (err) { if (request.current === current) setError((err as Error).message); }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden && !busy) void refresh(); }, 4500);
    return () => { clearInterval(timer); request.current += 1; };
  }, [busy, refresh]);

  async function changeBoard(action: "state" | "reset") {
    if (!ready || busy) return;
    if (action === "reset" && !window.confirm("开启新一轮？披萨会回到 0/" + CAPACITY + "，这一轮的问题仍可按轮次查看和导出。")) return;
    setBusy(action);
    setNotice("");
    request.current += 1;
    try {
      const data = await api<BoardState>("/api/host/" + action, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reset" ? { round: board.round } : { open: !board.open }),
      });
      setBoard(data);
      if (action === "reset") {
        setSelectedRound(null);
        setNotice("已开启第 " + data.round + " 轮。上一轮投稿可在下方切换查看。");
      }
      await refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(null); }
  }

  const round = selectedRound ?? board.round;
  const current = questions.filter(q => q.round === board.round);
  const shareCount = current.filter(q => q.allowShare).length;
  const rounds = [...new Set([board.round, ...questions.map(q => q.round)])].sort((a, b) => b - a);
  const shown = questions.filter(q => q.round === round && (!shareOnly || q.allowShare));
  return <div className="site-shell host-shell">
    <Header right={<a href="/board" target="_blank" rel="noreferrer">打开投屏 <span aria-hidden="true">↗</span></a>}/>
    <main className="host-main">
      <div className="host-title">
        <div><p className="event-label">Pizza Chat · Vol.01</p><h1>主持人后台</h1>
        <p className="hero-copy">回收现场问题，挑选同意带回知乎的投稿。</p></div>
        <div className="host-title-actions">
          <button className="secondary-button" type="button" disabled={!ready || Boolean(busy)} onClick={() => void changeBoard("reset")}>
            {busy === "reset" ? "正在重置…" : "重置本轮"}
          </button>
          <a className="primary-button download-button" href={ready ? "/api/host/export?round=" + round : "/api/host/export"} download>导出 Excel <span aria-hidden="true">↓</span></a>
        </div>
      </div>
      <div className="host-metrics">
        <div><span>拼图进度</span><strong>{ready ? board.count + "/" + board.capacity : "—"}</strong></div>
        <div><span>收到问题</span><strong>{ready ? current.length : "—"}</strong></div>
        <div><span>同意公开</span><strong>{ready ? shareCount : "—"}</strong></div>
        <div className="host-state"><span>投稿状态</span><strong>{ready ? board.open ? "开放中" : "已暂停" : "—"}</strong>
          <button className="text-button" disabled={!ready || Boolean(busy)} type="button" onClick={() => void changeBoard("state")}>{busy === "state" ? "更新中…" : board.open ? "暂停投稿" : "重新开放"}</button></div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="host-notice" role="status">{notice}</p>}
      <section className="host-questions">
        <div className="host-toolbar"><h2>现场问题</h2>
          {ready && <label className="round-label"><span>投稿轮次</span>
            <select value={round} onChange={event => {
              const picked = Number(event.target.value);
              setSelectedRound(picked === board.round ? null : picked);
            }}>{rounds.map(value => <option key={value} value={value}>
              {"第 " + value + " 轮" + (value === board.round ? "（当前）" : "")}
            </option>)}</select></label>}
          <label className="check-label"><input type="checkbox" checked={shareOnly} onChange={event => setShareOnly(event.target.checked)}/> 只看同意公开</label>
          <button type="button" className="text-button" disabled={Boolean(busy)} onClick={() => void refresh()}>刷新</button>
        </div>
        {!shown.length ? <p className="host-empty">{!ready ? "正在读取问题…" : shareOnly ? "暂时没有同意公开的投稿。" : "第一条问题出现后，会显示在这里。"}</p> :
          <ol className="question-list">{shown.map(q => <li key={q.id}>
            <div className="question-meta"><span>#{q.id}</span><time dateTime={q.createdAt}>{localTime(q.createdAt)}</time>
            <span className={q.allowShare ? "share-yes" : "share-no"}>{q.allowShare ? "同意匿名发布" : "仅活动内部"}</span></div>
            <p>{q.question}</p>
          </li>)}</ol>}
      </section>
    </main>
    <Footer host={false}/>
  </div>;
}

export function HostGate({ authenticated, signInUrl }: { authenticated: boolean; signInUrl: string }) {
  return <div className="site-shell">
    <Header right={<a href="/board">看现场披萨 <span aria-hidden="true">↗</span></a>}/>
    <main className="gate-main"><p className="event-label">Pizza Chat · Vol.01</p><h1>主持人后台</h1>
      <p className="hero-copy">{authenticated ? "请切换到活动主理人的 ChatGPT 账号。" : "用活动主理人的 ChatGPT 账号登录，就能查看和导出问题。"}</p>
      <a className="primary-button" href={authenticated ? "/signout-with-chatgpt?return_to=%2Fhost" : signInUrl} target="_top">
        {authenticated ? "切换账号" : "用 ChatGPT 登录"} <span aria-hidden="true">↗</span></a>
    </main><Footer host={false}/>
  </div>;
}
