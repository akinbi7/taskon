import { useCallback, useEffect, useState } from "react";
import { apiCall } from "../../lib/api";
import { displayName, formatPoints } from "../../lib/format";
import type { AdminOverview } from "../../types";
import { AdminBlock, AdminError, AdminLoading } from "../../components/admin/AdminBits";

export function OverviewPanel({
  onOpenFlags,
  onOpenPeople,
}: {
  onOpenFlags: () => void;
  onOpenPeople: (query: string) => void;
}) {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await apiCall<AdminOverview>("admin.overview"));
    } catch (loadError) {
      setError(loadError);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  if (error) return <AdminError error={error} onRetry={() => setReloadKey((k) => k + 1)} />;
  if (!data) return <AdminLoading label="Adding up the numbers…" />;

  return (
    <div className="admin-overview">
      {data.flags_count > 0 ? (
        <button type="button" className="admin-callout" onClick={onOpenFlags}>
          <span>{data.flags_count}</span>
          <p>
            {data.flags_count === 1 ? "account needs" : "accounts need"} a look. Referral
            bursts or impossible claim times.
          </p>
          <strong>Review →</strong>
        </button>
      ) : null}

      <div className="admin-ledger">
        <div className="admin-ledger__lead">
          <span>Total users</span>
          <strong>{formatPoints(data.total_users)}</strong>
          <small>{formatPoints(data.new_today)} new today</small>
        </div>
        <div>
          <span>Active today</span>
          <strong>{formatPoints(data.active_today)}</strong>
          <small>seen since midnight UTC</small>
        </div>
        <div>
          <span>Tasks today</span>
          <strong>{formatPoints(data.tasks_today)}</strong>
          <small>{formatPoints(data.checkins_today)} check-ins too</small>
        </div>
        <div>
          <span>Points issued today</span>
          <strong>{formatPoints(data.points_today)}</strong>
          <small>{formatPoints(data.total_points)} in circulation</small>
        </div>
      </div>

      <div className="admin-two-col">
        <AdminBlock title="Top referrers" aside={<span className="admin-mini">all time</span>}>
          {data.top_referrers.length > 0 ? (
            <ol className="admin-rank-list">
              {data.top_referrers.map((person, index) => (
                <li key={person.telegram_id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <button
                    type="button"
                    onClick={() => onOpenPeople(person.username ?? String(person.telegram_id))}
                    title="Search for this person"
                  >
                    {displayName({
                      firstName: person.first_name,
                      username: person.username,
                      telegramId: person.telegram_id,
                    })}
                  </button>
                  <strong>{formatPoints(person.refs)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="admin-empty">No referral bonuses awarded yet.</p>
          )}
        </AdminBlock>

        <AdminBlock title="Most finished" aside={<span className="admin-mini">all time</span>}>
          {data.top_tasks.length > 0 ? (
            <ol className="admin-rank-list">
              {data.top_tasks.map((task) => (
                <li key={task.title}>
                  <span aria-hidden="true">·</span>
                  <span className="admin-rank-list__title">{task.title}</span>
                  <strong>{formatPoints(task.completions)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="admin-empty">No tasks completed yet.</p>
          )}
        </AdminBlock>
      </div>

      <div className="admin-ticker">
        <span>Banned: {formatPoints(data.banned_users)}</span>
        <span>Referrals today: {formatPoints(data.referrals_today)}</span>
        <span>Flagged: {formatPoints(data.flags_count)}</span>
        <span>New today: {formatPoints(data.new_today)}</span>
      </div>
    </div>
  );
}
