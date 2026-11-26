import { describe, expect, it } from "vitest";
import {
  parseReferralStartParam,
  verifyInitData,
} from "../../../supabase/functions/_shared/telegram";

const BOT_TOKEN = "123456789:AAFakeTokenFor_Tests_only-1234567890";

const encoder = new TextEncoder();

async function sign(initData: string, botToken: string): Promise<string> {
  const params = new URLSearchParams(initData);
  params.delete("hash");
  params.delete("signature");
  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const base = await crypto.subtle.importKey(
    "raw",
    encoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const secret = await crypto.subtle.sign("HMAC", base, encoder.encode(botToken));
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(checkString));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function makeInitData(overrides: Record<string, string> = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    query_id: "AAExample",
    user: JSON.stringify({ id: 42, first_name: "Ada", username: "ada" }),
    auth_date: String(now),
    start_param: "ref_9001",
    ...overrides,
  });
  params.delete("hash");
  const hash = await sign(params.toString(), BOT_TOKEN);
  params.set("hash", hash);
  return params.toString();
}

describe("verifyInitData", () => {
  it("accepts a correctly signed session", async () => {
    const initData = await makeInitData();
    const result = await verifyInitData(initData, BOT_TOKEN);
    expect(result.user.id).toBe(42);
    expect(result.user.username).toBe("ada");
    expect(result.startParam).toBe("ref_9001");
  });

  it("ignores the optional signature field when checking the hash", async () => {
    const initData = `${await makeInitData()}&signature=ed25519-not-used-here`;
    await expect(verifyInitData(initData, BOT_TOKEN)).resolves.toBeTruthy();
  });

  it("rejects tampered user data", async () => {
    const initData = await makeInitData();
    const tampered = initData.replace("Ada", "Mallory");
    await expect(verifyInitData(tampered, BOT_TOKEN)).rejects.toMatchObject({
      code: "invalid_init_data",
    });
  });

  it("rejects a different bot token", async () => {
    const initData = await makeInitData();
    await expect(verifyInitData(initData, "999:other-token")).rejects.toMatchObject({
      code: "invalid_init_data",
    });
  });

  it("rejects old sessions", async () => {
    const old = await makeInitData({
      auth_date: String(Math.floor(Date.now() / 1000) - 60 * 60 * 25),
    });
    await expect(verifyInitData(old, BOT_TOKEN)).rejects.toMatchObject({
      code: "init_data_expired",
    });
  });

  it("rejects missing and malformed sessions", async () => {
    await expect(verifyInitData("", BOT_TOKEN)).rejects.toMatchObject({
      code: "missing_init_data",
    });
    await expect(verifyInitData("user=%7B%7D", BOT_TOKEN)).rejects.toMatchObject({
      code: "invalid_init_data",
    });
  });

  it("rejects anything that isn't a signed initData string", async () => {
    await expect(verifyInitData("demo:77:Nadia", BOT_TOKEN)).rejects.toMatchObject({
      code: "invalid_init_data",
    });
  });
});

describe("parseReferralStartParam", () => {
  it("accepts ref_<id>", () => {
    expect(parseReferralStartParam("ref_123456789")).toBe(123456789);
  });

  it("rejects everything else", () => {
    expect(parseReferralStartParam("ref_")).toBeNull();
    expect(parseReferralStartParam("ref_abc")).toBeNull();
    expect(parseReferralStartParam("ref_12_34")).toBeNull();
    expect(parseReferralStartParam(null)).toBeNull();
  });
});
