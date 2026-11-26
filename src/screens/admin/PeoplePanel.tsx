import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiCall } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import {
  displayName,
  formatPoints,
  formatShortDate,
  initials,
  relativeDay,
} from "../../lib/format";
import type { AdminUser } from "../../types";
import { useToast } from "../../lib/toast";
import { AdminBlock, AdminEmpty, AdminError, AdminLoading } from "../../components/admin/AdminBits";
import { IconSearch } from "../../components/Icons";

export function PeoplePanel({ initialQuery }: { initialQuery: string }) {
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [query, setQuery] = useState(initialQuery);
  const [panel, setPanel] = useState<{ userId: string; mode: "points" | "ban" } | null>(null);
  const [delta, setDelta] = useState("50");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { notify } = useToast();

  const load = useCallback(async (search: string) => {
    try {
      setError(null);
      setRows(await apiCall<AdminUser[]>("admin.users.search", { query: search }));
    } catch (loadError) {
      setError(loadError);
    }
  }, []);

  useEffect(() => {
    void load(initialQuery);
  }, [load, initialQuery, reloadKey]);

  function openPanel(user: AdminUser, mode: "points" | "ban") {
    if (panel?.userId === user.id && panel.mode === mode) {
      setPanel(null);
      return;
    }
    setPanel({ userId: user.id, mode });
    setDelta("50");
    setReason("");
  }

  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    await load(query.trim());
  }

  async function adjust(user: AdminUser) {
    const value = Number(delta);
    if (!Number.isFinite(value) || Math.trunc(value) !== value || value === 0) {
      notify("Enter a whole number that isn't zero.", "warn");
      return;
    }
    setBusy(true);
    try {
      const result = await apiCall<{ points: number }>("admin.users.adjust", {
        userId: user.id,
        delta: value,
        reason: reason.trim(),
      });
      notify(`Points updated. New balance ${formatPoints(result.points)}.`, "good");
      setPanel(null);
      await load(query.trim());
    } catch (adjustError) {
      notify(errorMessage(adjustError), "warn");
    } finally {
      setBusy(false);
    }
  }

  async function ban(user: AdminUser) {
    const banned = !user.banned;
    if (banned && reason.trim().length < 3) {
      notify("Add a short reason for the ban.", "warn");
      return;
    }
    setBusy(true);
    try {
      await apiCall("admin.users.ban", {
        userId: user.id,
        banned,
        reason: reason.trim(),
      });
      notify(banned ? "Account banned." : "Account unbanned.", "good");
      setPanel(null);
      await load(query.trim());
    } catch (banError) {
      notify(errorMessage(banError), "warn");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-people">
      <form className="admin-search" onSubmit={(event) => void submitSearch(event)}>
        <IconSearch size={17} />
        <input
          type="search"
          value={query}
          placeholder="Username, name or ID"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" className="btn btn--primary btn--small">
          Search
        </button>
        {query ? (
          <button
            type="button"
            className="admin-link"
            onClick={() => {
              setQuery("");
              void load("");
            }}
          >
            Clear
          </button>
        ) : null}
      </form>

      {error ? <AdminError error={error} onRetry={() => setReloadKey((k) => k + 1)} /> : null}
      {!rows && !error ? <AdminLoading label="Looking through accounts…" /> : null}

      {rows ? (
        <AdminBlock
          title={query ? `Results for "${query}"` : "Recent accounts"}
          aside={<span className="admin-mini">{rows.length} shown</span>}
        >
          {rows.length === 0 ? <AdminEmpty>No account matched that.</AdminEmpty> : null}
          <ul className="admin-person-list">
            {rows.map((user) => {
              const open = panel?.userId === user.id;
              return (
                <li key={user.id} className={user.banned ? "is-banned" : ""}>
                  <div className="admin-person">
                    <span className="admin-person__monogram" aria-hidden="true">
                      {initials(user.firstName ?? user.username)}
                    </span>
                    <div className="admin-person__who">
                      <h3>
                        {displayName({
                          firstName: user.firstName,
                          username: user.username,
                          telegramId: user.telegramId,
                        })}
                        {user.banned ? <span className="admin-badge admin-badge--banned">banned</span> : null}
                      </h3>
                      <p>
                        {user.username ? `@${user.username} · ` : ""}ID {user.telegramId}
                      </p>
                      <p>
                        joined {relativeDay(user.createdAt)} <span className="dot">·</span> seen{" "}
                        {formatShortDate(user.lastSeenAt)}
                        {user.banReason ? <span className="admin-person__ban"> — {user.banReason}</span> : null}
                      </p>
                    </div>
                    <div className="admin-person__points">
                      <strong>{formatPoints(user.points)}</strong>
                      <span>points</span>
                    </div>
                  </div>

                  <div className="admin-person__meta">
                    <span>{formatPoints(user.referrals)} referrals</span>
                    <span>{formatPoints(user.referralEarnings)} from referrals</span>
                    <span>{formatPoints(user.tasksDone)} tasks done</span>
                    <span>streak {user.streak}</span>
                  </div>

                  <div className="admin-person__actions">
                    <button
                      type="button"
                      className="admin-link"
                      onClick={() => openPanel(user, "points")}
                      aria-expanded={open && panel?.mode === "points"}
                    >
                      Adjust points
                    </button>
                    <button
                      type="button"
                      className={`admin-link ${user.banned ? "" : "admin-link--danger"}`}
                      onClick={() => openPanel(user, "ban")}
                      aria-expanded={open && panel?.mode === "ban"}
                    >
                      {user.banned ? "Unban" : "Ban"}
                    </button>
                  </div>

                  {open ? (
                    <div className="admin-inline-form">
                      {panel?.mode === "points" ? (
                        <>
                          <label className="field field--small">
                            <span>Change</span>
                            <input
                              type="number"
                              value={delta}
                              onChange={(event) => setDelta(event.target.value)}
                              placeholder="50 or -25"
                            />
                          </label>
                          <label className="field field--grow">
                            <span>Reason (logged)</span>
                            <input
                              type="text"
                              value={reason}
                              maxLength={200}
                              placeholder="Missed referral bonus"
                              onChange={(event) => setReason(event.target.value)}
                            />
                          </label>
                          <button
                            type="button"
                            className="btn btn--primary btn--small"
                            disabled={busy}
                            onClick={() => void adjust(user)}
                          >
                            {busy ? "Saving…" : "Apply"}
                          </button>
                        </>
                      ) : (
                        <>
                          <label className="field field--grow">
                            <span>{user.banned ? "Reason for lifting the ban" : "Reason (required)"}</span>
                            <input
                              type="text"
                              value={reason}
                              maxLength={200}
                              placeholder={user.banned ? "Appeal accepted" : "Duplicate account"}
                              onChange={(event) => setReason(event.target.value)}
                            />
                          </label>
                          <button
                            type="button"
                            className={`btn btn--small ${user.banned ? "btn--primary" : "btn--danger"}`}
                            disabled={busy}
                            onClick={() => void ban(user)}
                          >
                            {busy ? "Saving…" : user.banned ? "Unban account" : "Ban account"}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="admin-link"
                        onClick={() => setPanel(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </AdminBlock>
      ) : null}
    </div>
  );
}
