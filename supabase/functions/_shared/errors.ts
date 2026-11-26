export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export const MESSAGES: Record<string, string> = {
  missing_init_data: "Open Taskon from inside Telegram so we can verify you.",
  invalid_init_data: "We couldn't verify this Telegram session. Reopen the app from the bot.",
  init_data_expired: "This session is old. Close Taskon and open it again.",
  server_misconfigured: "The server is missing its bot token. Tell the admin.",
  user_not_found: "We couldn't find that account.",
  user_banned: "This account can't earn points right now.",
  already_checked_in: "You already checked in today. The next one opens after midnight UTC.",
  task_unavailable: "This task isn't open anymore.",
  task_already_completed: "You already collected this one.",
  task_not_started: "Open the task first, then come back to claim it.",
  too_soon: "Not yet — the clock is still running on this one.",
  membership_not_found: "You're not in that channel yet. Join it, then check again.",
  verification_failed:
    "We can't check that channel right now. The bot may need to be added to it.",
  not_admin: "This door only opens for admins.",
  slow_down: "That was quick. Give it a minute, then try again.",
  invalid_title: "Give the task a title between 3 and 120 characters.",
  invalid_type: "That task type isn't one we support.",
  invalid_reward: "The reward has to be between 1 and 10,000 points.",
  invalid_url: "That link doesn't look right. Use a full https:// address.",
  invalid_timer: "The timer has to be between 5 and 900 seconds.",
  invalid_delta: "Enter a point change that isn't zero.",
  reason_required: "Add a short reason before saving.",
  task_not_found: "That task doesn't exist anymore.",
  cannot_ban_self: "You can't ban your own account.",
  bad_request: "Something in that request was missing.",
  internal_error: "Something went wrong on our side. Try again in a moment.",
};

/** Turns a Postgres `raise exception 'code'` from an RPC into an API error. */
export function fromDbError(error: unknown): ApiError {
  const raw =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error ?? "");

  const known = Object.keys(MESSAGES).find((code) => raw.includes(code));
  if (known) {
    const status =
      known === "user_banned" || known === "membership_not_found"
        ? 403
        : known === "task_unavailable"
          ? 410
          : known === "internal_error"
            ? 500
            : known === "user_not_found" || known === "task_not_found"
              ? 404
              : 400;
    return new ApiError(known, MESSAGES[known], status);
  }

  if (raw.toLowerCase().includes("rate limit")) {
    return new ApiError("slow_down", MESSAGES.slow_down, 429);
  }

  console.error("Unmapped database error:", raw);
  return new ApiError("internal_error", MESSAGES.internal_error, 500);
}
