import { useCallback, useEffect, useState } from "react";
import { apiCall } from "../../lib/api";
import { formatShortDate } from "../../lib/format";
import type { AuditEntry } from "../../types";
import { AdminEmpty, AdminError, AdminLoading, actionLabel } from "../../components/admin/AdminBits";

export function AuditPanel() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setError(null);
      setEntries(await apiCall<AuditEntry[]>("admin.audit"));
    } catch (loadError) {
      setError(loadError);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  return (
    <div className="admin-audit">
      <div className="admin-toolbar">
        <div>
          <h2>Audit log</h2>
          <p>Every state-changing admin action, newest first.</p>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => setReloadKey((k) => k + 1)}
        >
          Refresh
        </button>
      </div>

      {error ? <AdminError error={error} onRetry={() => setReloadKey((k) => k + 1)} /> : null}
      {!entries && !error ? <AdminLoading label="Reading the log…" /> : null}

      {entries ? (
        entries.length === 0 ? (
          <AdminEmpty>No admin actions yet.</AdminEmpty>
        ) : (
          <ul className="audit-list">
            {entries.map((entry) => (
              <li key={entry.id}>
                <div className="audit-list__time">{formatShortDate(entry.createdAt)}</div>
                <div className="audit-list__body">
                  <h3>
                    {actionLabel(entry.action)}
                    {entry.targetUsername ? <span> @{entry.targetUsername}</span> : null}
                    {entry.targetTaskTitle ? <span> “{entry.targetTaskTitle}”</span> : null}
                  </h3>
                  {entry.reason ? <p className="audit-list__reason">{entry.reason}</p> : null}
                  {entry.details && Object.keys(entry.details).length > 0 ? (
                    <details>
                      <summary>Details</summary>
                      <pre>{JSON.stringify(entry.details, null, 2)}</pre>
                    </details>
                  ) : null}
                </div>
                <div className="audit-list__admin">
                  admin
                  <br />
                  {entry.adminTelegramId}
                </div>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
