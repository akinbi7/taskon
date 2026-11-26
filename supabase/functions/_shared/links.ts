/** Turns a stored task URL into a chat reference accepted by getChatMember. */
export function channelRefFromUrl(rawUrl: string): string | null {
  const value = rawUrl.trim();
  if (value.startsWith("@")) return value;
  if (/^-?\d{5,}$/.test(value)) return value;

  try {
    const url = new URL(value);
    if (!["t.me", "telegram.me", "telegram.dog"].includes(url.hostname)) return null;
    const segment = url.pathname.split("/").filter(Boolean)[0];
    if (!segment || segment.startsWith("+") || segment.toLowerCase() === "joinchat") {
      return null;
    }
    return `@${segment}`;
  } catch {
    return null;
  }
}
