import type { Db } from "./db.ts";
import type { AuthContext } from "./auth.ts";
import { fromDbError } from "./errors.ts";

const BASE_CHECKIN = 10;
const BONUS_PER_DAY = 2;
const BONUS_CAP = 10;
const REFERRER_BONUS = 50;
const REFERRED_BONUS = 25;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function bonusForStreak(streak: number): number {
  return Math.min(Math.max(streak - 1, 0) * BONUS_PER_DAY, BONUS_CAP);
}

export interface SessionPayload {
  user: {
    id: string;
    telegramId: number;
    username: string | null;
    firstName: string | null;
    points: number;
    streak: number;
    lastCheckin: string | null;
    isAdmin: boolean;
  };
  checkin: {
    available: boolean;
    doneToday: boolean;
    streak: number;
    projectedStreak: number;
    base: number;
    bonus: number;
    reward: number;
  };
  counts: {
    tasksAvailable: number;
    tasksCompleted: number;
    referrals: number;
    referralEarnings: number;
  };
  rank: { position: number | null; total: number };
  referral: {
    code: string;
    link: string;
    referrerBonus: number;
    referredBonus: number;
    invited: number;
    earned: number;
    recent: Array<{ firstName: string | null; username: string | null; joinedAt: string }>;
  };
  nextTasks: Array<{ id: string; title: string; reward: number; type: string }>;
  welcomeBonus: number;
}

export async function buildSession(db: Db, ctx: AuthContext): Promise<SessionPayload> {
  const now = new Date();
  const today = isoDate(now);
  const yesterday = isoDate(new Date(now.getTime() - 86_400_000));
  const doneToday = ctx.user.last_checkin === today;

  // A missed day breaks the streak even if users.streak still holds the old
  // number. Never show a streak that is no longer alive.
  const currentStreak = doneToday
    ? ctx.user.streak
    : ctx.user.last_checkin === yesterday
      ? ctx.user.streak
      : 0;

  const projectedStreak = doneToday ? ctx.user.streak + 1 : currentStreak + 1;
  const bonus = bonusForStreak(projectedStreak);
  const reward = BASE_CHECKIN + bonus;

  const [
    tasksResult,
    completedResult,
    referralCountResult,
    earningsResult,
    recentReferralsResult,
    rankResult,
    totalResult,
  ] = await Promise.all([
    db.from("tasks").select("id,title,type,reward,active,expires_at,created_at").order("created_at"),
    db.from("user_tasks").select("task_id").eq("user_id", ctx.user.id),
    db
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", ctx.user.id),
    db
      .from("referrals")
      .select("referrer_bonus")
      .eq("referrer_id", ctx.user.id)
      .eq("bonus_paid", true),
    db
      .from("referrals")
      .select("created_at,referred_id")
      .eq("referrer_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    db.rpc("get_leaderboard", { p_user_id: ctx.user.id, p_limit: 100 }),
    db.from("users").select("id", { count: "exact", head: true }).eq("banned", false),
  ]);

  const earned = (earningsResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.referrer_bonus ?? 0),
    0,
  );

  const completedIds = new Set((completedResult.data ?? []).map((row) => row.task_id as string));
  const availableTasks = (tasksResult.data ?? []).filter((task) => {
    if (completedIds.has(task.id as string)) return false;
    if (!task.active) return false;
    if (task.expires_at && new Date(task.expires_at as string).getTime() <= now.getTime()) {
      return false;
    }
    return true;
  });

  const allReferrals = recentReferralsResult.data ?? [];
  const invited = referralCountResult.count ?? 0;

  let recent: SessionPayload["referral"]["recent"] = [];
  if (allReferrals.length > 0) {
    const ids = allReferrals.map((row) => row.referred_id as string);
    const { data: people } = await db
      .from("users")
      .select("id,first_name,username")
      .in("id", ids);
    const byId = new Map((people ?? []).map((person) => [person.id as string, person]));
    recent = allReferrals.map((row) => {
      const person = byId.get(row.referred_id as string);
      return {
        firstName: (person?.first_name as string | null) ?? null,
        username: (person?.username as string | null) ?? null,
        joinedAt: row.created_at as string,
      };
    });
  }

  const meOnBoard = (rankResult.data ?? []).find(
    (row: Record<string, unknown>) => row.is_me === true,
  );
  const botUsername = Deno.env.get("BOT_USERNAME") ?? "";
  const code = String(ctx.user.telegram_id);

  return {
    user: {
      id: ctx.user.id,
      telegramId: Number(ctx.user.telegram_id),
      username: ctx.user.username,
      firstName: ctx.user.first_name,
      points: ctx.user.points,
      streak: currentStreak,
      lastCheckin: ctx.user.last_checkin,
      isAdmin: ctx.isAdmin,
    },
    checkin: {
      available: !doneToday,
      doneToday,
      streak: currentStreak,
      projectedStreak,
      base: BASE_CHECKIN,
      bonus,
      reward,
    },
    counts: {
      tasksAvailable: availableTasks.length,
      tasksCompleted: completedIds.size,
      referrals: invited,
      referralEarnings: earned,
    },
    rank: {
      // Same ordering as the leaderboard, so the two screens can't disagree.
      position: meOnBoard ? Number(meOnBoard.place) : null,
      total: totalResult.count ?? 0,
    },
    referral: {
      code,
      link: botUsername ? `https://t.me/${botUsername}?startapp=ref_${code}` : "",
      referrerBonus: REFERRER_BONUS,
      referredBonus: REFERRED_BONUS,
      invited,
      earned,
      recent,
    },
    nextTasks: availableTasks.slice(0, 2).map((task) => ({
      id: task.id as string,
      title: task.title as string,
      reward: Number(task.reward),
      type: task.type as string,
    })),
    welcomeBonus: ctx.referralBonus,
  };
}

export async function claimCheckin(db: Db, userId: string) {
  const { data, error } = await db.rpc("claim_daily_checkin", { p_user_id: userId });
  if (error) throw fromDbError(error);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) throw fromDbError("user_not_found");
  return {
    points: Number(row.new_points),
    streak: Number(row.new_streak),
    reward: Number(row.reward),
    bonus: Number(row.bonus),
  };
}
