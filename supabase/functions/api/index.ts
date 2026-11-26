import { authenticate, enforceRateLimit } from "../_shared/auth.ts";
import { handleAdmin } from "../_shared/admin.ts";
import { getServiceClient } from "../_shared/db.ts";
import { ApiError, fromDbError, MESSAGES } from "../_shared/errors.ts";
import { isUuid, json, preflight } from "../_shared/http.ts";
import { buildSession, claimCheckin } from "../_shared/session.ts";
import { claimTask, listTasks, startTask } from "../_shared/tasks.ts";

type Payload = Record<string, unknown>;

function payloadOf(body: Record<string, unknown>): Payload {
  return typeof body.payload === "object" && body.payload !== null
    ? (body.payload as Payload)
    : {};
}

function requireTaskId(payload: Payload): string {
  if (!isUuid(payload.taskId)) {
    throw new ApiError("task_unavailable", MESSAGES.task_unavailable, 400);
  }
  return payload.taskId;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);

  try {
    if (req.method !== "POST") {
      throw new ApiError("bad_request", MESSAGES.bad_request, 405);
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      throw new ApiError("bad_request", MESSAGES.bad_request, 400);
    }

    const action = typeof body.action === "string" ? body.action : "";
    if (!action) throw new ApiError("bad_request", MESSAGES.bad_request, 400);

    const db = getServiceClient();
    const ctx = await authenticate(req, db, body.initData);
    const payload = payloadOf(body);
    const isAdminAction = action.startsWith("admin.");

    // A blanket ceiling; individual actions below add tighter limits.
    await enforceRateLimit(db, ctx.user.id, "api", 180, 60);

    switch (action) {
      case "session": {
        await enforceRateLimit(db, ctx.user.id, "session", 90, 60);
        return json(req, { data: await buildSession(db, ctx) });
      }

      case "checkin": {
        await enforceRateLimit(db, ctx.user.id, "checkin", 10, 3600);
        const result = await claimCheckin(db, ctx.user.id);
        return json(req, { data: result });
      }

      case "tasks.list": {
        await enforceRateLimit(db, ctx.user.id, "tasks.list", 90, 60);
        return json(req, { data: await listTasks(db, ctx.user.id) });
      }

      case "tasks.start": {
        await enforceRateLimit(db, ctx.user.id, "tasks.start", 30, 60);
        const taskId = requireTaskId(payload);
        return json(req, { data: await startTask(db, ctx.user.id, taskId) });
      }

      case "tasks.claim": {
        await enforceRateLimit(db, ctx.user.id, "tasks.claim", 30, 60);
        const taskId = requireTaskId(payload);
        const result = await claimTask(
          db,
          ctx.user,
          taskId,
          Deno.env.get("BOT_TOKEN") ?? "",
        );
        return json(req, { data: result });
      }

      case "referrals": {
        await enforceRateLimit(db, ctx.user.id, "referrals", 60, 60);
        const session = await buildSession(db, ctx);
        return json(req, {
          data: {
            referral: session.referral,
            counts: session.counts,
          },
        });
      }

      case "leaderboard": {
        await enforceRateLimit(db, ctx.user.id, "leaderboard", 60, 60);
        const [board, total] = await Promise.all([
          db.rpc("get_leaderboard", { p_user_id: ctx.user.id, p_limit: 100 }),
          db.from("users").select("id", { count: "exact", head: true }).eq("banned", false),
        ]);
        if (board.error) throw fromDbError(board.error);

        const rows = (board.data ?? []).map((row: Record<string, unknown>) => ({
          position: Number(row.place),
          telegramId: row.telegram_id,
          username: row.username,
          firstName: row.first_name,
          points: row.points,
          isMe: row.is_me === true,
        }));

        return json(req, {
          data: {
            top: rows.filter((row) => row.position <= 100),
            me: rows.find((row) => row.isMe) ?? null,
            total: total.count ?? 0,
          },
        });
      }

      default: {
        if (isAdminAction) {
          return json(req, {
            data: await handleAdmin(db, ctx, action, payload),
          });
        }
        throw new ApiError("bad_request", "Unknown action.", 404);
      }
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return json(
        req,
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    }
    console.error("Unhandled API error:", error);
    return json(
      req,
      { error: { code: "internal_error", message: MESSAGES.internal_error } },
      500,
    );
  }
});
