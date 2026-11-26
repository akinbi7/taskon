import type { Db } from "./db.ts";
import type { AuthContext } from "./auth.ts";
import { enforceRateLimit } from "./auth.ts";
import { ApiError, fromDbError, MESSAGES } from "./errors.ts";
import { isUuid } from "./http.ts";
import type { TaskType } from "./tasks.ts";

type Payload = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function assertTaskInput(payload: Payload) {
  const title = asString(payload.title);
  const type = asString(payload.type) as TaskType;
  const url = asString(payload.url);
  const reward = asInteger(payload.reward);
  const timerSeconds = asInteger(payload.timerSeconds ?? 20);

  if (title.length < 3 || title.length > 120) {
    throw new ApiError("invalid_title", MESSAGES.invalid_title, 400);
  }
  if (!["join_channel", "visit_link", "follow_x", "partner"].includes(type)) {
    throw new ApiError("invalid_type", MESSAGES.invalid_type, 400);
  }
  if (reward === null || reward < 1 || reward > 10000) {
    throw new ApiError("invalid_reward", MESSAGES.invalid_reward, 400);
  }
  const validUrl =
    type === "join_channel"
      ? /^@[A-Za-z0-9_]{4,32}$/.test(url) || /^https:\/\/t\.me\/[A-Za-z0-9_]{4,32}\/?$/.test(url)
      : /^https?:\/\//.test(url);
  if (!validUrl) {
    throw new ApiError("invalid_url", MESSAGES.invalid_url, 400);
  }
  if (timerSeconds === null || timerSeconds < 5 || timerSeconds > 900) {
    throw new ApiError("invalid_timer", MESSAGES.invalid_timer, 400);
  }

  let expiresAt: string | null = null;
  if (payload.expiresAt) {
    const parsed = new Date(String(payload.expiresAt));
    if (Number.isNaN(parsed.getTime())) {
      throw new ApiError("bad_request", "That expiry date isn't valid.", 400);
    }
    expiresAt = parsed.toISOString();
  }

  return { title, type, url, reward, timerSeconds, expiresAt };
}

export async function handleAdmin(
  db: Db,
  ctx: AuthContext,
  action: string,
  payload: Payload,
): Promise<unknown> {
  if (!ctx.isAdmin) {
    throw new ApiError("not_admin", MESSAGES.not_admin, 403);
  }

  await enforceRateLimit(db, ctx.user.id, "admin", 180, 60);
  const adminId = Number(ctx.user.telegram_id);

  switch (action) {
    case "admin.overview": {
      const { data, error } = await db.rpc("admin_stats");
      if (error) throw fromDbError(error);
      return data;
    }

    case "admin.tasks.list": {
      const { data, error } = await db
        .from("tasks")
        .select("id,title,type,reward,url,active,timer_seconds,expires_at,created_at,user_tasks(count)")
        .order("created_at", { ascending: false });
      if (error) throw fromDbError(error);

      return (data ?? []).map((row) => {
        const relation = (row as { user_tasks?: Array<{ count?: number }> }).user_tasks;
        return {
          id: row.id,
          title: row.title,
          type: row.type,
          reward: row.reward,
          url: row.url,
          active: row.active,
          timerSeconds: row.timer_seconds,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
          completions: relation?.[0]?.count ?? 0,
        };
      });
    }

    case "admin.tasks.save": {
      const input = assertTaskInput(payload);
      const taskId = payload.id ?? null;
      if (taskId !== null && !isUuid(taskId)) {
        throw new ApiError("task_not_found", MESSAGES.task_not_found, 404);
      }

      const { data, error } = await db.rpc("admin_task_upsert", {
        p_admin_telegram_id: adminId,
        p_task_id: taskId,
        p_title: input.title,
        p_type: input.type,
        p_reward: input.reward,
        p_url: input.url,
        p_timer_seconds: input.type === "join_channel" ? 20 : input.timerSeconds,
        p_expires_at: input.expiresAt,
      });
      if (error) throw fromDbError(error);
      return { id: data };
    }

    case "admin.tasks.toggle": {
      if (!isUuid(payload.id)) throw new ApiError("task_not_found", MESSAGES.task_not_found, 404);
      const active = asBoolean(payload.active);
      if (active === null) throw new ApiError("bad_request", MESSAGES.bad_request, 400);
      const { error } = await db.rpc("admin_task_toggle", {
        p_admin_telegram_id: adminId,
        p_task_id: payload.id,
        p_active: active,
      });
      if (error) throw fromDbError(error);
      return { id: payload.id, active };
    }

    case "admin.tasks.delete": {
      if (!isUuid(payload.id)) throw new ApiError("task_not_found", MESSAGES.task_not_found, 404);
      const { error } = await db.rpc("admin_task_delete", {
        p_admin_telegram_id: adminId,
        p_task_id: payload.id,
      });
      if (error) throw fromDbError(error);
      return { id: payload.id };
    }

    case "admin.users.search": {
      const query = asString(payload.query).replace(/^@+/, "");
      const { data, error } = await db.rpc("admin_search_users", {
        p_query: query,
        p_limit: 25,
      });
      if (error) throw fromDbError(error);
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.user_id,
        telegramId: row.telegram_id,
        username: row.username,
        firstName: row.first_name,
        points: row.points,
        streak: row.streak,
        banned: row.banned,
        banReason: row.ban_reason,
        referrals: row.referrals,
        referralEarnings: row.referral_earnings,
        tasksDone: row.tasks_done,
        lastSeenAt: row.last_seen_at,
        createdAt: row.created_at,
      }));
    }

    case "admin.users.adjust": {
      if (!isUuid(payload.userId)) throw new ApiError("user_not_found", MESSAGES.user_not_found, 404);
      const delta = asInteger(payload.delta);
      const reason = asString(payload.reason);
      if (delta === null || delta === 0 || Math.abs(delta) > 100000) {
        throw new ApiError("invalid_delta", MESSAGES.invalid_delta, 400);
      }
      if (reason.length < 3) {
        throw new ApiError("reason_required", MESSAGES.reason_required, 400);
      }
      const { data, error } = await db.rpc("admin_adjust_points", {
        p_admin_telegram_id: adminId,
        p_user_id: payload.userId,
        p_delta: delta,
        p_reason: reason,
      });
      if (error) throw fromDbError(error);
      return { points: data };
    }

    case "admin.users.ban": {
      if (!isUuid(payload.userId)) throw new ApiError("user_not_found", MESSAGES.user_not_found, 404);
      const banned = asBoolean(payload.banned);
      if (banned === null) throw new ApiError("bad_request", MESSAGES.bad_request, 400);
      const reason = asString(payload.reason);
      if (banned && reason.length < 3) {
        throw new ApiError("reason_required", "Add a short reason for the ban.", 400);
      }
      const { error } = await db.rpc("admin_set_ban", {
        p_admin_telegram_id: adminId,
        p_user_id: payload.userId,
        p_banned: banned,
        p_reason: reason || null,
      });
      if (error) throw fromDbError(error);
      return { id: payload.userId, banned };
    }

    case "admin.flags": {
      const { data, error } = await db.rpc("admin_flags", { p_limit: 100 });
      if (error) throw fromDbError(error);
      return (data ?? []).map((row: Record<string, unknown>) => ({
        userId: row.user_id,
        telegramId: row.telegram_id,
        username: row.username,
        firstName: row.first_name,
        flags: row.flags,
        refs24h: row.refs_24h,
        refs1h: row.refs_1h,
        sameSecondClaims: row.same_second_claims,
        points: row.points,
        lastSeenAt: row.last_seen_at,
      }));
    }

    case "admin.audit": {
      const { data, error } = await db.rpc("admin_audit", { p_limit: 200 });
      if (error) throw fromDbError(error);
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id,
        adminTelegramId: row.admin_telegram_id,
        action: row.action,
        reason: row.reason,
        details: row.details,
        createdAt: row.created_at,
        targetUsername: row.target_username,
        targetTaskTitle: row.target_task_title,
      }));
    }

    default:
      throw new ApiError("bad_request", "Unknown admin action.", 400);
  }
}
