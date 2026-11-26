import { useCallback, useEffect, useState } from "react";
import { apiCall } from "../../lib/api";
import { displayName, formatPoints, formatShortDate, initials } from "../../lib/format";
import type { AdminFlag } from "../../types";
import { AdminBlock, AdminEmpty, AdminError, AdminLoading, flagLabel } from "../../components/admin/AdminBits";

export function FlagsPanel({ onReview }: { onReview: (query: string) => void }) {
  const [flags, setFlags] = useState<AdminFlag[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setError(null);
      setFlags(await apiCall<AdminFlag[]>("admin.flags"));
    } catch (loadError) {
      setError(loadError);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  return (
    <div className="admin-flags">
      <div className="admin-toolbar">
        <div>
          <h2>Flags</h2>
          <p>Patterns, not verdicts. Check the account before you ban it.</p>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => setReloadKey((k) => k + 1)}
        >
          Re-check
        </button>
      </div>

      {error ? <AdminError error={error} onRetry={() => setReloadKey((k) => k + 1)} /> : null}
      {!flags && !error ? <AdminLoading label="Looking for patterns…" /> : null}

      {flags ? (
        <AdminBlock
          title="Suspicious accounts"
          aside={<span className="admin-mini">{flags.length} flagged</span>}
        >
          {flags.length === 0 ? (
            <AdminEmpty>Nothing looks off. Referral bursts and same-second claims will show here.</AdminEmpty>
          ) : (
            <ul className="admin-flag-list">
              {flags.map((flag) => (
                <li key={flag.userId}>
                  <div className="admin-flag__top">
                    <span className="admin-person__monogram" aria-hidden="true">
                      {initials(flag.firstName ?? flag.username)}
                    </span>
                    <div>
                      <h3>
                        {displayName({
                          firstName: flag.firstName,
                          username: flag.username,
                          telegramId: flag.telegramId,
                        })}
                      </h3>
                      <p>
                        {flag.username ? `@${flag.username} · ` : ""}ID {flag.telegramId} ·{" "}
                        {formatPoints(flag.points)} points · seen {formatShortDate(flag.lastSeenAt)}
                      </p>
                    </div>
                  </div>

                  <ul className="admin-flag__reasons">
                    {flag.flags.map((item) => (
                      <li key={item}>
                        <strong>{flagLabel(item)}</strong>
                        <span>
                          {item === "referral_burst"
                            ? `${flag.refs1h} referrals in the last hour`
                            : item === "referral_volume"
                              ? `${flag.refs24h} referrals in 24 hours`
                              : `${flag.sameSecondClaims} ${flag.sameSecondClaims === 1 ? "time" : "times"} two claims landed in the same second`}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className="admin-link"
                    onClick={() =>
                      onReview(flag.username ?? String(flag.telegramId))
                    }
                  >
                    Review this account →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </AdminBlock>
      ) : null}
    </div>
  );
}
