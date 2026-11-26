// Telegram Mini App initData verification.
// Pure WebCrypto so it runs in Supabase Edge Functions and in Vitest.
//
// Algorithm (Telegram docs):
//   secret_key = HMAC_SHA256(key: "WebAppData", message: bot_token)
//   check_hash = HMAC_SHA256(key: secret_key, message: data_check_string)
// data_check_string is every field except hash/signature, sorted by key,
// joined as key=value with newlines.

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface VerifiedInitData {
  user: TelegramUser;
  startParam: string | null;
  authDate: number;
}

export class TelegramAuthError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "TelegramAuthError";
    this.code = code;
  }
}

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function hmacSha256(
  keyBytes: Uint8Array | ArrayBuffer,
  message: string,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, encoder.encode(message));
}

export function buildDataCheckString(
  entries: Iterable<[string, string]>,
  keepSignature = false,
): string {
  return Array.from(entries)
    .filter(([key]) => key !== "hash" && (keepSignature || key !== "signature"))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export async function signInitData(
  initData: string,
  botToken: string,
  keepSignature = false,
): Promise<string> {
  const params = new URLSearchParams(initData);
  params.delete("hash");
  if (!keepSignature) params.delete("signature");
  const dataCheckString = buildDataCheckString(params.entries(), keepSignature);
  const secret = await hmacSha256(encoder.encode("WebAppData"), botToken);
  const signature = await hmacSha256(secret, dataCheckString);
  return toHex(signature);
}

/**
 * Telegram clients disagree on one detail: some fold the Ed25519 `signature`
 * field into the data-check-string, others omit it. Both are valid HMACs over
 * the bot token, so accept either form.
 */
export async function candidateSignatures(
  initData: string,
  botToken: string,
): Promise<string[]> {
  const withOut = await signInitData(initData, botToken, false);
  const withSignature = await signInitData(initData, botToken, true);
  return withOut === withSignature ? [withOut] : [withOut, withSignature];
}

export interface VerifyOptions {
  maxAgeSeconds?: number;
  now?: number;
}

export async function verifyInitData(
  rawInitData: string,
  botToken: string,
  options: VerifyOptions = {},
): Promise<VerifiedInitData> {
  if (!rawInitData) {
    throw new TelegramAuthError(
      "missing_init_data",
      "Open Taskon from inside Telegram so we can verify you.",
    );
  }

  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
  const maxAge = options.maxAgeSeconds ?? 60 * 60 * 24;

  if (!botToken) {
    throw new TelegramAuthError("server_misconfigured", "Bot token is missing on the server.");
  }

  const params = new URLSearchParams(rawInitData);
  const hash = params.get("hash");
  if (!hash) {
    throw new TelegramAuthError("invalid_init_data", "This session is missing its signature.");
  }

  const authDateRaw = params.get("auth_date");
  const authDate = Number(authDateRaw);
  if (!authDateRaw || !Number.isFinite(authDate)) {
    throw new TelegramAuthError("invalid_init_data", "This session has no timestamp.");
  }
  if (nowSeconds - authDate > maxAge) {
    throw new TelegramAuthError(
      "init_data_expired",
      "This session is old. Close Taskon and open it again.",
    );
  }
  if (authDate - nowSeconds > 120) {
    throw new TelegramAuthError("invalid_init_data", "This session timestamp is in the future.");
  }

  const expected = await candidateSignatures(rawInitData, botToken);
  const received = hash.toLowerCase();
  if (!expected.some((candidate) => constantTimeEqual(candidate, received))) {
    throw new TelegramAuthError(
      "invalid_init_data",
      "We couldn't verify this Telegram session. Reopen the app from the bot.",
    );
  }

  let user: TelegramUser;
  try {
    user = JSON.parse(params.get("user") ?? "") as TelegramUser;
  } catch {
    throw new TelegramAuthError("invalid_init_data", "This session has no user.");
  }

  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) {
    throw new TelegramAuthError("invalid_init_data", "This session has an invalid user.");
  }

  return {
    user,
    startParam: params.get("start_param"),
    authDate,
  };
}

/** `ref_123456` -> 123456. Anything else -> null. */
export function parseReferralStartParam(startParam: string | null | undefined): number | null {
  if (!startParam) return null;
  const match = /^ref_(\d{1,20})$/.exec(startParam);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
