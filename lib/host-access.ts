export function isHost(request: Request, expectedEmail: string | undefined) {
  if (!expectedEmail || !request.headers.get("oai-authenticated-user-id")) return false;
  const actualEmail = request.headers.get("oai-authenticated-user-email");
  return actualEmail?.toLowerCase() === expectedEmail.toLowerCase();
}
