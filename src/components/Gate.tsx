import { Wordmark } from "../components/Icons";
import { errorMessage, errorCode } from "../lib/errors";

export function LoadingScreen({ label = "Counting the points…" }: { label?: string }) {
  return (
    <div className="gate">
      <div className="gate__mark">
        <Wordmark />
      </div>
      <div className="gate__rule" aria-hidden="true" />
      <p className="gate__loading">{label}</p>
    </div>
  );
}

export function Gate({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const bot = import.meta.env.VITE_BOT_USERNAME;
  const code = errorCode(error);
  const isAuth = ["missing_init_data", "invalid_init_data", "init_data_expired"].includes(code);

  return (
    <div className="gate">
      <div className="gate__mark">
        <Wordmark />
      </div>
      <p className="eyebrow">One small thing</p>
      <h1>{isAuth ? "Taskon lives inside Telegram." : "We couldn't open the door."}</h1>
      <p className="gate__copy">
        {isAuth
          ? "Open it from the bot so we can check that it's really you. The app runs in Telegram's own browser."
          : errorMessage(error)}
      </p>
      {onRetry ? (
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
      {isAuth && bot ? (
        <a className="gate__bot" href={`https://t.me/${bot}`} target="_blank" rel="noreferrer">
          Open @{bot}
        </a>
      ) : null}
      <p className="gate__fine">Points only. Nothing here is money.</p>
    </div>
  );
}
