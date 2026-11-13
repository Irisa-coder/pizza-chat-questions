import { env } from "cloudflare:workers";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import { HostGate, HostPanel } from "../game";

export const dynamic = "force-dynamic";

export default async function HostPage() {
  if (env.PIZZA_STANDALONE === "1") return <HostPanel/>;

  const user = await getChatGPTUser();
  if (user && env.PIZZA_HOST_EMAIL && user.email.toLowerCase() === env.PIZZA_HOST_EMAIL.toLowerCase()) {
    return <HostPanel/>;
  }
  return <HostGate authenticated={Boolean(user)} signInUrl={chatGPTSignInPath("/host")}/>;
}
