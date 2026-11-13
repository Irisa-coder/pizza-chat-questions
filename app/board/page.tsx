import { env } from "cloudflare:workers";
import { Board } from "../game";

export default function BoardPage() {
  return <Board standalone={env.PIZZA_STANDALONE === "1"}/>;
}
