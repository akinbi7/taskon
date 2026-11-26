import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiCall } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { formatShortDate, formatPoints, typeLabel } from "../../lib/format";
import type { AdminTask, TaskType } from "../../types";
import { useToast } from "../../lib/toast";
import { AdminBlock, AdminEmpty, AdminError, AdminLoading } from "../../components/admin/AdminBits";
import { IconPlus } from "../../components/Icons";

interface Draft {
  id?: string;
  title: string;
  type: TaskType;
  reward: number;
  url: string;
  timerSeconds: number;
  expiresAt: string;
}

const EMPTY_DRAFT: Draft = {
  title: "",
  type: "visit_link",
  reward: 30,
  url: "",
  timerSeconds: 20,
  expiresAt: "",
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function TasksPanel() {
  const [tasks, setTasks] = useState<AdminTask[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { notify } = useToast();

  const load = useCallback(async () => {
    try {
      setError(null);
      setTasks(await apiCall<AdminTask[]>("admin.tasks.list"));
    } catch (loadError) {
      setError(loadError);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  function edit(task: AdminTask) {
    setDraft({
      id: task.id,
      title: task.title,
      type: task.type,
      reward: task.reward,
      url: task.url,
      timerSeconds: task.timerSeconds,
      expiresAt: toLocalInput(task.expiresAt),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    try {
      await apiCall("admin.tasks.save", {
        id: draft.id ?? null,
        title: draft.title,
        type: draft.type,
        reward: Number(draft.reward),
        url: draft.url,
        timerSeconds: Number(draft.timerSeconds),
        expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
      });
      notify(draft.id ? "Task updated." : "Task added to the list.", "good");
      setDraft(null);
      await load();
    } catch (saveError) {
      notify(errorMessage(saveError), "warn");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(task: AdminTask) {
    try {
      await apiCall("admin.tasks.toggle", { id: task.id, active: !task.active });
      notify(task.active ? "Task disabled." : "Task enabled.", "good");
      await load();
    } catch (toggleError) {
      notify(errorMessage(toggleError), "warn");
    }
  }

  async function remove(task: AdminTask) {
    try {
      await apiCall("admin.tasks.delete", { id: task.id });
      notify(`Deleted “${task.title}”.`, "good");
      setConfirmDelete(null);
      await load();
    } catch (deleteError) {
      notify(errorMessage(deleteError), "warn");
    }
  }

  return (
    <div className="admin-tasks">
      <div className="admin-toolbar">
        <div>
          <h2>Tasks</h2>
          <p>{tasks ? `${tasks.length} total, ${tasks.filter((task) => task.active).length} live` : "…"}</p>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--small"
          onClick={() => setDraft(draft ? null : { ...EMPTY_DRAFT })}
        >
          <IconPlus size={15} /> {draft ? "Close form" : "New task"}
        </button>
      </div>

      {draft ? (
        <form className="admin-form" onSubmit={(event) => void save(event)}>
          <div className="admin-form__head">
            <h3>{draft.id ? "Edit task" : "New task"}</h3>
            <p>
              {draft.type === "join_channel"
                ? "Add the bot to the channel first, otherwise membership checks fail."
                : "The timer is enforced on the server, not in the browser."}
            </p>
          </div>

          <label className="field">
            <span>Title</span>
            <input
              type="text"
              value={draft.title}
              maxLength={120}
              required
              placeholder="Read the October notes"
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Type</span>
              <select
                value={draft.type}
                onChange={(event) =>
                  setDraft({ ...draft, type: event.target.value as TaskType })
                }
              >
                <option value="visit_link">Visit a link</option>
                <option value="join_channel">Join a channel</option>
                <option value="follow_x">Follow on X</option>
                <option value="partner">Partner task</option>
              </select>
            </label>
            <label className="field">
              <span>Reward</span>
              <input
                type="number"
                min={1}
                max={10000}
                required
                value={draft.reward}
                onChange={(event) =>
                  setDraft({ ...draft, reward: Number(event.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Timer (seconds)</span>
              <input
                type="number"
                min={5}
                max={900}
                disabled={draft.type === "join_channel"}
                value={draft.type === "join_channel" ? 20 : draft.timerSeconds}
                onChange={(event) =>
                  setDraft({ ...draft, timerSeconds: Number(event.target.value) })
                }
              />
            </label>
          </div>

          <label className="field">
            <span>URL</span>
            <input
              type="text"
              value={draft.url}
              required
              placeholder={
                draft.type === "join_channel" ? "https://t.me/yourchannel" : "https://…"
              }
              onChange={(event) => setDraft({ ...draft, url: event.target.value })}
            />
            <small>
              {draft.type === "join_channel"
                ? "Use https://t.me/yourchannel or @yourchannel. The bot has to be an admin there."
                : "Must start with https://."}
            </small>
          </label>

          <label className="field">
            <span>Expires (optional)</span>
            <input
              type="datetime-local"
              value={draft.expiresAt}
              onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })}
            />
            <small>Leave empty to keep it open until you disable it.</small>
          </label>

          <div className="admin-form__actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? "Saving…" : draft.id ? "Save changes" : "Add task"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {error ? <AdminError error={error} onRetry={() => setReloadKey((k) => k + 1)} /> : null}
      {!tasks && !error ? <AdminLoading label="Fetching tasks…" /> : null}

      {tasks ? (
        <AdminBlock title="All tasks" aside={<span className="admin-mini">newest first</span>}>
          {tasks.length === 0 ? <AdminEmpty>No tasks yet. Add the first one above.</AdminEmpty> : null}
          <ul className="admin-task-list">
            {tasks.map((task) => (
              <li key={task.id} className={!task.active ? "is-off" : ""}>
                <div className="admin-task-list__main">
                  <div className="admin-task-list__title">
                    <h3>{task.title}</h3>
                    <span className={`admin-badge ${task.active ? "admin-badge--live" : ""}`}>
                      {task.active ? "live" : "off"}
                    </span>
                  </div>
                  <p className="admin-task-list__meta">
                    {typeLabel(task.type)} <span className="dot">·</span>{" "}
                    {formatPoints(task.reward)} points <span className="dot">·</span>{" "}
                    {formatPoints(task.completions)} done
                    {task.expiresAt ? (
                      <>
                        <span className="dot">·</span> until {formatShortDate(task.expiresAt)}
                      </>
                    ) : null}
                  </p>
                  <p className="admin-task-list__url">{task.url}</p>
                </div>
                <div className="admin-task-list__actions">
                  <button type="button" className="admin-link" onClick={() => edit(task)}>
                    Edit
                  </button>
                  <button type="button" className="admin-link" onClick={() => void toggle(task)}>
                    {task.active ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className="admin-link admin-link--danger"
                    onClick={() => setConfirmDelete(confirmDelete === task.id ? null : task.id)}
                  >
                    Delete
                  </button>
                </div>
                {confirmDelete === task.id ? (
                  <div className="admin-confirm">
                    <p>Delete “{task.title}” and its claim history? This can't be undone.</p>
                    <div>
                      <button
                        type="button"
                        className="btn btn--danger btn--small"
                        onClick={() => void remove(task)}
                      >
                        Delete it
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Keep it
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </AdminBlock>
      ) : null}
    </div>
  );
}
