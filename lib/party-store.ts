import { CAPACITY, QUESTION_LIMIT, TOPPING_KEYS, type BoardState, type MyPiece, type Question, type Topping } from "./event";

type Row = {
  id: number;
  submission_id: string;
  visitor_hash: string;
  question: string;
  allow_share: number;
  topping: Topping;
  created_at: string;
  round: number;
};

type StateRow = { closed: number; round: number };
type FirstRow = Pick<Row, "id" | "round" | "topping"> & { slot: number };

const stateSql = "SELECT closed, round FROM event_state WHERE id = 1";
const currentRoundSql = "COALESCE((SELECT round FROM event_state WHERE id = 1), 1)";
const firstRowsSql =
  "SELECT q.id, q.topping FROM questions AS q " +
  "JOIN (SELECT MIN(id) AS id FROM questions WHERE round = " + currentRoundSql +
  " GROUP BY visitor_hash) AS firsts ON q.id = firsts.id ORDER BY q.id LIMIT ?";
const questionsSql = "SELECT id, question, allow_share, topping, created_at, round FROM questions";

export function normalizeQuestion(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const text = input.trim();
  const length = Array.from(text).length;
  return length >= 3 && length <= QUESTION_LIMIT ? text : null;
}

export async function visitorHash(device: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(device));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function snapshot(pieces: D1Result<Pick<Row, "id" | "topping">>, state: D1Result<StateRow>): BoardState {
  return {
    pieces: pieces.results.map((row, index) => ({ slot: index + 1, topping: row.topping })),
    count: pieces.results.length,
    capacity: CAPACITY,
    open: state.results[0]?.closed !== 1,
    round: state.results[0]?.round ?? 1,
  };
}

export async function readBoard(db: D1Database): Promise<BoardState> {
  const [pieces, state] = await db.batch([
    db.prepare(firstRowsSql).bind(CAPACITY),
    db.prepare(stateSql),
  ]);
  return snapshot(pieces as D1Result<Pick<Row, "id" | "topping">>, state as D1Result<StateRow>);
}

async function readFirstQuestion(db: D1Database, hash: string, round?: number) {
  return db.prepare(
    "SELECT q.id, q.round, q.topping, " +
    "(SELECT COUNT(DISTINCT earlier.visitor_hash) FROM questions AS earlier " +
    "WHERE earlier.round = q.round AND earlier.id <= q.id) AS slot " +
    "FROM questions AS q WHERE q.visitor_hash = ? AND q.round = COALESCE(?, " + currentRoundSql + ") " +
    "ORDER BY q.id LIMIT 1",
  ).bind(hash, round ?? null).first<FirstRow>();
}

export async function readMine(db: D1Database, hash: string): Promise<MyPiece | null> {
  const row = await readFirstQuestion(db, hash);
  return row ? { slot: row.slot, topping: row.topping, round: row.round, first: false } : null;
}

export async function submitQuestion(db: D1Database, input: {
  submissionId: string; hash: string; question: string; allowShare: boolean; round: number;
}) {
  const topping = TOPPING_KEYS[crypto.getRandomValues(new Uint32Array(1))[0] % TOPPING_KEYS.length];
  const createdAt = new Date().toISOString();
  const [insertion, existing, pieces, state] = await db.batch([
    db.prepare(
      "INSERT INTO questions (submission_id, visitor_hash, question, allow_share, topping, created_at, round) " +
      "SELECT ?, ?, ?, ?, ?, ?, ? WHERE ? = " + currentRoundSql + " " +
      "AND COALESCE((SELECT closed FROM event_state WHERE id = 1), 0) = 0 " +
      "AND (SELECT COUNT(*) FROM questions WHERE visitor_hash = ? AND round = ?) < 10 " +
      "ON CONFLICT(submission_id) DO NOTHING",
    ).bind(input.submissionId, input.hash, input.question, Number(input.allowShare), topping, createdAt,
      input.round, input.round, input.hash, input.round),
    db.prepare("SELECT id, visitor_hash, question, allow_share, round FROM questions WHERE submission_id = ?").bind(input.submissionId),
    db.prepare(firstRowsSql).bind(CAPACITY),
    db.prepare(stateSql),
  ]);
  const board = snapshot(pieces as D1Result<Pick<Row, "id" | "topping">>, state as D1Result<StateRow>);
  if (board.round !== input.round) return { status: "reset" as const, board };
  const row = existing.results[0] as Pick<Row, "id" | "visitor_hash" | "question" | "allow_share" | "round"> | undefined;
  if (!row) return { status: board.open ? "limit" as const : "closed" as const };
  if (row.visitor_hash !== input.hash || row.question !== input.question ||
      row.allow_share !== Number(input.allowShare) || row.round !== input.round) {
    return { status: "conflict" as const };
  }

  const first = await readFirstQuestion(db, input.hash, input.round);
  if (!first) throw new Error("Missing confirmed first submission.");
  return {
    status: "ok" as const, board, inserted: insertion.meta.changes > 0,
    mine: { slot: first.slot, topping: first.topping, round: first.round, first: first.id === row.id },
  };
}

function formatQuestions(rows: Omit<Row, "submission_id" | "visitor_hash">[]): Question[] {
  return rows.map(row => ({
    id: row.id, round: row.round, question: row.question, allowShare: row.allow_share === 1,
    topping: row.topping, createdAt: row.created_at,
  }));
}

export async function readHostState(db: D1Database) {
  const [questions, pieces, state] = await db.batch([
    db.prepare(questionsSql + " ORDER BY id"),
    db.prepare(firstRowsSql).bind(CAPACITY),
    db.prepare(stateSql),
  ]);
  return {
    questions: formatQuestions(questions.results as Omit<Row, "submission_id" | "visitor_hash">[]),
    board: snapshot(pieces as D1Result<Pick<Row, "id" | "topping">>, state as D1Result<StateRow>),
  };
}

export async function readQuestions(db: D1Database, round?: number): Promise<Question[]> {
  const { results } = await db.prepare(
    questionsSql + " WHERE round = COALESCE(?, " + currentRoundSql + ") ORDER BY id",
  ).bind(round ?? null).all<Omit<Row, "submission_id" | "visitor_hash">>();
  return formatQuestions(results);
}

export async function setOpen(db: D1Database, open: boolean) {
  await db.prepare(
    "INSERT INTO event_state (id, closed) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET closed = excluded.closed",
  ).bind(Number(!open)).run();
}

export async function resetRound(db: D1Database, expectedRound: number): Promise<BoardState> {
  await db.prepare(
    "INSERT INTO event_state (id, closed, round) SELECT 1, 0, ? + 1 WHERE ? = " + currentRoundSql +
    " ON CONFLICT(id) DO UPDATE SET round = excluded.round",
  ).bind(expectedRound, expectedRound).run();
  return readBoard(db);
}
