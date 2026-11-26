import { useCallback, useEffect, useState } from "react";
import { apiCall } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { formatPoints } from "../lib/format";
import type { LeaderboardData } from "../types";
import { IconFlag } from "../components/Icons";

function nameOf(row: {
  firstName: string | null;
  username: string | null;
  telegramId: number;
  isMe: boolean;
}): string {
  if (row.isMe) return "You";
  return row.firstName ?? (row.username ? `@${row.username}` : `#${row.telegramId}`);
}

export function Ranks() {
  const [board, setBoard] = useState<LeaderboardData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    try {
      setError(null);
      setBoard(await apiCall<LeaderboardData>("leaderboard"));
    } catch (loadError) {
      setError(loadError);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const top = board?.top ?? [];
  const podium = top.slice(0, 3);
  const rest = top.slice(3);

  return (
    <div className="screen screen--ranks">
      <header className="page-head">
        <p className="eyebrow">Standings</p>
        <h1>The board</h1>
        <p className="lede">
          Top 100 by points. Banned accounts don't appear. Points come from check-ins,
          finished tasks and the occasional friend.
        </p>
      </header>

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

      {!board && !error ? (
        <div className="rank-skeletons" aria-label="Loading the board">
          {[0, 1, 2, 3, 4].map((row) => (
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

      {board ? (
        <>
          <section className="podium" aria-label="Top three">
            {podium.map((row, index) => (
              <article
                key={row.telegramId}
                className={`podium-row podium-row--${index + 1} ${row.isMe ? "is-me" : ""}`}
              >
                <span className="podium-row__place">{String(row.position).padStart(2, "0")}</span>
                <div className="podium-row__who">
                  <h2>
                    {nameOf(row)}
                    {row.isMe ? <span className="you-tag">you</span> : null}
                  </h2>
                  <p>
                    {row.username && !row.isMe ? `@${row.username}` : "Taskon member"}
                    {index === 0 ? (
                      <span className="podium-row__flag">
                        <IconFlag size={13} /> first
                      </span>
                    ) : null}
                  </p>
                </div>
                <span className="podium-row__points">
                  {formatPoints(row.points)}
                  <small>pts</small>
                </span>
              </article>
            ))}
          </section>

          <section className="rank-table" aria-label="Ranks four to one hundred">
            <div className="rank-table__head">
              <span>Place</span>
              <span>Who</span>
              <span>Points</span>
            </div>
            <ol>
              {rest.map((row) => (
                <li key={row.telegramId} className={row.isMe ? "is-me" : ""}>
                  <span className="rank-table__place">{row.position}</span>
                  <span className="rank-table__who">
                    {nameOf(row)}
                    {row.username && !row.isMe ? <small>@{row.username}</small> : null}
                  </span>
                  <span className="rank-table__points">{formatPoints(row.points)}</span>
                </li>
              ))}
            </ol>
          </section>

          {board.me ? (
            <aside className="my-rank" aria-label="Your rank">
              <div>
                <span className="my-rank__label">Your place</span>
                <strong>No. {board.me.position}</strong>
              </div>
              <div className="my-rank__points">
                {formatPoints(board.me.points)}
                <small>points</small>
              </div>
              <span className="my-rank__outof">of {formatPoints(board.total)}</span>
            </aside>
          ) : null}

          <p className="fine-print">
            Ties are broken by whoever joined first. The board refreshes when you open this
            tab.
          </p>
        </>
      ) : null}
    </div>
  );
}
