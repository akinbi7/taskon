import type { ReactNode } from "react";
import { errorMessage } from "../../lib/errors";

export function AdminError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="admin-notice admin-notice--error" role="alert">
      <p>{errorMessage(error)}</p>
      <button type="button" className="btn btn--ghost btn--small" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function AdminLoading({ label = "Fetching…" }: { label?: string }) {
  return (
    <div className="admin-notice admin-notice--loading">
      <span className="admin-pulse" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <p className="admin-empty">{children}</p>;
}

export function AdminBlock({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-block ${className ?? ""}`}>
      <div className="admin-block__head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const FLAG_COPY: Record<string, string> = {
  referral_burst: "Many referrals in one hour",
  referral_volume: "High referral volume in 24h",
  same_second_claims: "Two claims in the same second",
};

export function flagLabel(flag: string): string {
  return FLAG_COPY[flag] ?? flag.replace(/_/g, " ");
}

const ACTION_COPY: Record<string, string> = {
  "task.create": "Created task",
  "task.edit": "Edited task",
  "task.enable": "Enabled task",
  "task.disable": "Disabled task",
  "task.delete": "Deleted task",
  "user.adjust_points": "Adjusted points",
  "user.ban": "Banned user",
  "user.unban": "Unbanned user",
};

export function actionLabel(action: string): string {
  return ACTION_COPY[action] ?? action.replace(/[._]/g, " ");
}
