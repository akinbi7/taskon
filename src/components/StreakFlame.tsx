import { formatPoints } from "../lib/format";

export function StreakFlame({
  streak,
  lit = true,
  celebrating = false,
}: {
  streak: number;
  lit?: boolean;
  celebrating?: boolean;
}) {
  return (
    <div
      className={`flame ${lit ? "flame--lit" : ""} ${celebrating ? "flame--celebrating" : ""}`}
      aria-label={streak > 0 ? `${streak} day streak` : "No streak yet"}
      role="img"
    >
      <svg viewBox="0 0 52 68" aria-hidden="true" focusable="false">
        <path
          className="flame__halo"
          d="M25.4 4.2c2.8 9.2 10.4 13.2 10.2 25.4-.2 10.8-4.9 18.3-11.4 18.3-6.8 0-11-6.7-10.8-15.1.2-8 5-13.5 7.6-19.4 1.2-2.7 1.8-5.7 4.4-9.2Z"
        />
        <path
          className="flame__core"
          d="M24.3 20.2c1.2 4.6 5.1 7.2 5 13.1-.1 5.9-2.6 9.6-5.8 9.6-3.4 0-5.6-3.3-5.5-8.1.1-4.5 2.7-7.6 4.2-11.2.5-1.2.8-2.3 2.1-3.4Z"
        />
      </svg>
      <span className="flame__count">
        {streak}
        <small>{streak === 1 ? "day" : "days"}</small>
      </span>
      <span className="flame__sr">{formatPoints(streak)} day streak</span>
    </div>
  );
}
