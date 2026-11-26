import type { Db } from "./db.ts";
import type { TelegramUser } from "./telegram.ts";
import { parseReferralStartParam, TelegramAuthError, verifyInitData } from "./telegram.ts";
import { ApiError, fromDbError, MESSAGES } from "./errors.ts";

export interface AppUser {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  points: number;
  streak: number;
  last_checkin: string | null;
  referrer_id: string | null;
  banned: boolean;
  created_at: string;
}

export interface AuthContext {
  user: AppUser;
  telegramUser: TelegramUser;
  isAdmin: boolean;
  referralBonus: number;
  adminIds: Set<number>;
}

function adminIds(): Set<number> {
  return new Set(
    (Deno.env.get("ADMIN_IDS") ?? "")
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isSafeInteger(id) && id > 0),
  );
}

export async function authenticate(
  req: Request,
  db: Db,
  bodyInitData: unknown,
): Promise<AuthContext> {
  const headerInitData = req.headers.get("x-telegram-init-data");
  const initData =
    typeof bodyInitData === "string" && bodyInitData.length > 0
      ? bodyInitData
      : (headerInitData ?? "");

  let verified;
  try {
    verified = await verifyInitData(initData, Deno.env.get("BOT_TOKEN") ?? "");
  } catch (error) {
    if (error instanceof TelegramAuthError) {
      throw new ApiError(error.code, error.message, 401);
    }
    throw error;
  }

  const telegramId = Number(verified.user.id);
  const { data, error } = await db
    .from("users")
    .upsert(
      {
        telegram_id: telegramId,
        username: verified.user.username ?? null,
        first_name: verified.user.first_name ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "telegram_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw fromDbError(error ?? "user_not_found");
  }

  let user = data as AppUser;

  // Telegram sends start_param on the launch that carried ?startapp=ref_...
  // attach_referral is idempotent; self-referrals and repeats return 0.
  let referralBonus = 0;
  const referrerTelegramId = parseReferralStartParam(verified.startParam);
  if (
    referrerTelegramId &&
    referrerTelegramId !== telegramId &&
    !user.referrer_id &&
    !user.banned
  ) {
    const { data: bonus, error: referralError } = await db.rpc("attach_referral", {
      p_user_id: user.id,
      p_referrer_telegram_id: referrerTelegramId,
    });
    if (referralError) {
      console.error("attach_referral failed:", referralError.message);
    } else if (typeof bonus === "number" && bonus > 0) {
      referralBonus = bonus;
      const { data: fresh } = await db.from("users").select("*").eq("id", user.id).single();
      if (fresh) user = fresh as AppUser;
    }
  }

  if (user.banned) {
    throw new ApiError("user_banned", MESSAGES.user_banned, 403);
  }

  const admins = adminIds();
  return {
    user,
    telegramUser: verified.user,
    isAdmin: admins.has(telegramId),
    referralBonus,
    adminIds: admins,
  };
}

export async function enforceRateLimit(
  db: Db,
  userId: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const { data, error } = await db.rpc("check_rate_limit", {
    p_user_id: userId,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw fromDbError(error);
  if (data !== true) {
    throw new ApiError("slow_down", MESSAGES.slow_down, 429);
  }
}
