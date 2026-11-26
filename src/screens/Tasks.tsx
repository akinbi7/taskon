import { useCallback, useEffect, useState } from "react";
import { TaskRow } from "../components/TaskRow";
import { apiCall } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { haptic } from "../lib/telegram";
import { useSession } from "../lib/session";
import { useToast } from "../lib/toast";
import { formatPoints } from "../lib/format";
import type { ClaimResult, StartResult, TaskItem, TaskType } from "../types";

const FILTERS: Array<{ key: "all" | TaskType; label: string }> = [
  { key: "all", label: "All" },
  { key: "join_channel", label: "Channels" },
  { key: "visit_link", label: "Visits" },
  { key: "follow_x", label: "X" },
  { key: "partner", label: "Partners" },
];

export function Tasks() {
  const { refresh } = useSession();
  const { notify } = useToast();
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [filter, setFilter] = useState<"all" | TaskType>("all");
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setError(null);
      const next = await apiCall<TaskItem[]>("tasks.list");
      setTasks(next);
    } catch (loadError) {
      setError(loadError);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  async function start(task: TaskItem) {
    const result = await apiCall<StartResult>("tasks.start", { taskId: task.id });
    setTasks((current) =>
      (current ?? []).map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: "started",
              startedAt: result.startedAt,
              claimAt: result.claimAt,
              timerSeconds: result.timerSeconds,
            }
          : item,
      ),
    );
  }

  async function claim(task: TaskItem) {
    const result = await apiCall<ClaimResult>("tasks.claim", { taskId: task.id });
    setTasks((current) =>
      (current ?? []).map((item) =>
        item.id === task.id
          ? { ...item, status: "completed", completedAt: new Date().toISOString() }
          : item,
      ),
    );
    haptic("success");
    notify(`+${formatPoints(result.reward)} points. That one's done.`, "good");
    try {
      await refresh();
    } catch {
      /* balance catches up on the next open */
    }
  }

  const visible = (tasks ?? []).filter(
    (task) => filter === "all" || task.type === filter,
  );
  const open = visible.filter((task) => task.status !== "completed");
  const done = visible.filter((task) => task.status === "completed");

  return (
    <div className="screen screen--tasks">
      <header className="page-head">
        <p className="eyebrow">The list</p>
        <h1>Things to do</h1>
        <p className="lede">
          Small, specific, and credited the moment you finish. Channels are checked by the bot;
          everything else runs on a short timer.
        </p>
      </header>

      <nav className="filters" aria-label="Filter tasks">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`filter ${filter === item.key ? "is-active" : ""}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {error ? (
        <div className="inline-error">
          <p>{errorMessage(error)}</p>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      ) : null}

      {!tasks && !error ? (
        <div className="task-skeletons" aria-label="Loading tasks">
          {[0, 1, 2, 3].map((row) => (
            <div className="skeleton-row" key={row}>
              <span />
              <div>
                <span />
                <span />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tasks ? (
        <>
          <section className="task-group" aria-label="Open tasks">
            <div className="section-head section-head--tight">
              <h2>Open</h2>
              <span className="section-head__count">{open.length}</span>
            </div>
            {open.length > 0 ? (
              <div className="task-list">
                {open.map((task, index) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    index={index}
                    onStart={start}
                    onClaim={claim}
                  />
                ))}
              </div>
            ) : (
              <p className="empty-line">
                {filter === "all"
                  ? "That's the whole list for now. Check back tomorrow."
                  : "Nothing under that heading yet."}
              </p>
            )}
          </section>

          {done.length > 0 ? (
            <section className="task-group task-group--done" aria-label="Completed tasks">
              <div className="section-head section-head--tight">
                <h2>Done</h2>
                <span className="section-head__count">{done.length}</span>
              </div>
              <div className="task-list">
                {done.map((task, index) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    index={index}
                    onStart={start}
                    onClaim={claim}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      <p className="fine-print">
        One claim per task. If a channel check fails, the bot may need to be added to that
        channel — tell the admin rather than tapping again.
      </p>
    </div>
  );
}
