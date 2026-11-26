import { useEffect, useState } from "react";
import type { TaskItem } from "../types";
import { TaskGlyph, IconCheck, IconClock, IconArrowUpRight } from "./Icons";
import {
  expiryNote,
  formatClock,
  formatPoints,
  typeHint,
  typeShort,
} from "../lib/format";
import { haptic, openLink } from "../lib/telegram";
import { errorMessage } from "../lib/errors";
import { useToast } from "../lib/toast";

interface TaskRowProps {
  task: TaskItem;
  index: number;
  onStart: (task: TaskItem) => Promise<void>;
  onClaim: (task: TaskItem) => Promise<void>;
}

function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export function TaskRow({ task, index, onStart, onClaim }: TaskRowProps) {
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();
  const completed = task.status === "completed";
  const started = task.status === "started";
  const isChannel = task.type === "join_channel";
  const ticker = useTicker(started && !isChannel && !completed);
  const remaining = task.claimAt
    ? Math.max(0, (new Date(task.claimAt).getTime() - ticker) / 1000)
    : 0;
  const running = started && !isChannel && remaining > 0;
  const ready = started && (isChannel || remaining <= 0);
  const progress =
    started && !isChannel && task.timerSeconds > 0
      ? Math.min(1, Math.max(0, 1 - remaining / task.timerSeconds))
      : 1;

  const expiry = expiryNote(task.expiresAt);

  const taskUrl = task.url.startsWith("@") ? `https://t.me/${task.url.slice(1)}` : task.url;

  async function act() {
    if (busy || completed) return;
    setBusy(true);
    try {
      if (!started) {
        await onStart(task);
        haptic("light");
        openLink(taskUrl);
      } else if (ready) {
        await onClaim(task);
      }
    } catch (error) {
      notify(errorMessage(error), "warn");
      haptic("warning");
    } finally {
      setBusy(false);
    }
  }

  const actionLabel = completed
    ? "Collected"
    : busy
      ? "…"
      : running
        ? formatClock(remaining)
        : started
          ? isChannel
            ? "Check"
            : "Claim"
          : isChannel
            ? "Join"
            : "Start";

  const meta = [
    typeShort(task.type),
    `${formatPoints(task.reward)} points`,
    isChannel
      ? "verified by the bot"
      : task.timerSeconds > 0
        ? `${task.timerSeconds}s timer`
        : null,
    expiry,
  ].filter(Boolean);

  return (
    <article className={`task-row ${completed ? "is-complete" : ""} ${running ? "is-running" : ""}`}>
      <span className="task-row__index" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="task-row__main">
        <div className="task-row__head">
          <span className="task-row__glyph">
            <TaskGlyph type={task.type} size={20} />
          </span>
          <h3>{task.title}</h3>
        </div>
        <p className="task-row__meta">
          {meta.map((item, i) => (
            <span key={item}>
              {i > 0 ? <span className="dot" aria-hidden="true">·</span> : null}
              {item}
            </span>
          ))}
        </p>
        <p className="task-row__hint">{typeHint(task.type)}</p>

        {running ? (
          <div className="task-row__timer" aria-hidden="true">
            <span style={{ width: `${progress * 100}%` }} />
          </div>
        ) : null}
      </div>

      <div className="task-row__side">
        <button
          type="button"
          className={`task-action ${completed ? "task-action--done" : ""} ${running ? "task-action--running" : ""}`}
          disabled={busy || completed || running}
          onClick={() => void act()}
          aria-label={
            completed ? `${task.title}, collected` : `${actionLabel}: ${task.title}`
          }
        >
          {completed ? <IconCheck size={14} /> : null}
          {running ? <IconClock size={13} /> : null}
          {actionLabel}
        </button>
        {!completed ? (
          <button
            type="button"
            className="task-row__open"
            onClick={() => openLink(taskUrl)}
          >
            Open <IconArrowUpRight size={12} />
          </button>
        ) : null}
      </div>
    </article>
  );
}
