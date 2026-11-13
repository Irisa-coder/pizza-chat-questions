export const CAPACITY = 10;
export const GAME_TITLE = "把问题「打包」带走";
export const QUESTION_LIMIT = 320;
export const EVENT_ORIGIN = "https://pizza-chat-vol01-questions.irisat.chatgpt.site";

export const TOPPINGS = {
  pepperoni: { name: "辣香肠", color: "#F76E63", base: "#FFE5A1", ink: "#B63B32" },
  mushroom: { name: "蘑菇", color: "#C2815B", base: "#FFE9B6", ink: "#814524" },
  basil: { name: "罗勒", color: "#55BC97", base: "#FFF0AB", ink: "#217A5B" },
  corn: { name: "甜玉米", color: "#FFCA46", base: "#FFEDB9", ink: "#97610B" },
  olive: { name: "黑橄榄", color: "#A08BD4", base: "#FFF0B9", ink: "#645094" },
  pineapple: { name: "菠萝", color: "#FFB752", base: "#FFE6AC", ink: "#A45715" },
} as const;

export type Topping = keyof typeof TOPPINGS;
export const TOPPING_KEYS = Object.keys(TOPPINGS) as Topping[];
export type Piece = { slot: number; topping: Topping };
export type BoardState = { pieces: Piece[]; count: number; capacity: number; open: boolean; round: number };
export type MyPiece = Piece & { first: boolean; round: number };
export type Question = { id: number; round: number; question: string; allowShare: boolean; topping: Topping; createdAt: string };

export const participantUrl = EVENT_ORIGIN + "/";

export function localTime(value: string, includeYear = false) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", ...(includeYear ? { year: "numeric" } : {}), month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}
