import type { Db } from "./db.ts";
import type { AppUser } from "./auth.ts";
import { ApiError, fromDbError, MESSAGES } from "./errors.ts";
import { channelRefFromUrl } from "./links.ts";

export type TaskType = "join_channel" | "visit_link" | "follow_x" | "partner";

interface TaskRow {
  id: string;
  title: string;
  type: TaskType;
  reward: number;
  url: string;
  timer_seconds: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export interface TaskView {
  id: string;
  title: string;
  type: TaskType;
  reward: number;
  url: string;
  timerSeconds: number;
  expiresAt: string | null;
  status: "available" | "started" | "completed";
  startedAt?: string;
  claimAt?: string;
  completedAt?: string;
}

export async function listTasks(db: Db, userId: string): Promise<TaskView[]> {
  const [tasksResult, completedResult, startsResult] = await Promise.all([
    db.from("tasks").select("*").order("created_at", { ascending: true }),
    db.from("user_tasks").select("task_id,completed_at").eq("user_id", userId),
    db.from("user_task_starts").select("task_id,started_at").eq("user_id", userId),
  ]);

  if (tasksResult.error) throw fromDbError(tasksResult.error);

  const completed = new Map(
    (completedResult.data ?? []).map((row) => [row.task_id as string, row.completed_at as string]),
  );
  const starts = new Map(
    (startsResult.data ?? []).map((row) => [row.task_id as string, row.started_at as string]),
  );

  const now = Date.now();
  const views: TaskView[] = [];

  for (const task of (tasksResult.data ?? []) as TaskRow[]) {
    const completedAt = completed.get(task.id);
    const startedAt = starts.get(task.id);
    const expired = task.expires_at ? new Date(task.expires_at).getTime() <= now : false;

    if (!completedAt) {
      if (!task.active || expired) continue;
    }

    const timerSeconds = task.type === "join_channel" ? 0 : task.timer_seconds;
    const view: TaskView = {
      id: task.id,
      title: task.title,
      type: task.type,
      reward: task.reward,
      url: task.url,
      timerSeconds,
      expiresAt: task.expires_at,
      status: completedAt ? "completed" : startedAt ? "started" : "available",
    };

    if (startedAt) {
      view.startedAt = startedAt;
      view.claimAt = new Date(new Date(startedAt).getTime() + timerSeconds * 1000).toISOString();
    }
    if (completedAt) view.completedAt = completedAt;

    views.push(view);
  }

  return views.sort((a, b) => {
    const rank = { available: 0, started: 1, completed: 2 };
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return 0;
  });
}

export async function startTask(db: Db, userId: string, taskId: string) {
  const { data, error } = await db.rpc("start_task", {
    p_user_id: userId,
    p_task_id: taskId,
  });
  if (error) throw fromDbError(error);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) throw fromDbError("task_unavailable");
  return {
    startedAt: row.started_at as string,
    timerSeconds: Number(row.timer_seconds),
    claimAt: row.claim_at as string,
  };
}

async function isChannelMember(
  botToken: string,
  taskUrl: string,
  telegramId: number,
): Promise<boolean> {
  const chatId = channelRefFromUrl(taskUrl);
  if (!chatId) {
    throw new ApiError(
      "verification_failed",
      "This channel link can't be checked. Ask the admin to use a public @channel link.",
      400,
    );
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, user_id: telegramId }),
  });

  const body = (await response.json().catch(() => null)) as
    | { ok: boolean; result?: { status?: string; is_member?: boolean }; description?: string }
    | null;

  if (!response.ok || !body?.ok) {
    console.error("getChatMember failed:", body?.description ?? response.status);
    throw new ApiError(
      "verification_failed",
      "We can't check that channel right now. The bot may need to be added to it.",
      400,
    );
  }

  const status = body.result?.status;
  return (
    status === "creator" ||
    status === "administrator" ||
    status === "member" ||
    (status === "restricted" && body.result?.is_member === true)
  );
}

export async function claimTask(
  db: Db,
  user: AppUser,
  taskId: string,
  botToken: string,
): Promise<{ points: number; reward: number }> {
  const { data: task, error } = await db
    .from("tasks")
    .select("id,type,url,active,expires_at")
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw fromDbError(error);
  if (!task) throw fromDbError("task_unavailable");

  let verified = false;
  if (task.type === "join_channel") {
    if (!botToken) {
      throw new ApiError("server_misconfigured", MESSAGES.server_misconfigured, 500);
    }
    verified = await isChannelMember(botToken, task.url as string, Number(user.telegram_id));
    if (!verified) {
      throw new ApiError("membership_not_found", MESSAGES.membership_not_found, 403);
    }
  }

  const { data, error: claimError } = await db.rpc("complete_task", {
    p_user_id: user.id,
    p_task_id: taskId,
    p_verified: verified,
  });
  if (claimError) throw fromDbError(claimError);

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) throw fromDbError("internal_error");
  return { points: Number(row.new_points), reward: Number(row.reward) };
}
