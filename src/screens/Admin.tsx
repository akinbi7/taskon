import { useState } from "react";
import { AppLink } from "../components/AppLink";
import { Gate, LoadingScreen } from "../components/Gate";
import { IconBack, Wordmark } from "../components/Icons";
import { useSession } from "../lib/session";
import { displayName } from "../lib/format";
import { OverviewPanel } from "./admin/OverviewPanel";
import { TasksPanel } from "./admin/TasksPanel";
import { PeoplePanel } from "./admin/PeoplePanel";
import { FlagsPanel } from "./admin/FlagsPanel";
import { AuditPanel } from "./admin/AuditPanel";

type Tab = "overview" | "tasks" | "people" | "flags" | "audit";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "tasks", label: "Tasks" },
  { key: "people", label: "People" },
  { key: "flags", label: "Flags" },
  { key: "audit", label: "Log" },
];

export function Admin() {
  const { session, loading, error, retry } = useSession();
  const [tab, setTab] = useState<Tab>("overview");
  const [peopleQuery, setPeopleQuery] = useState("");

  if (loading) return <LoadingScreen label="Opening the console…" />;
  if (error || !session) return <Gate error={error} onRetry={retry} />;

  if (!session.user.isAdmin) {
    return (
      <div className="admin-locked">
        <Wordmark />
        <p className="eyebrow">Not your door</p>
        <h1>This console is for admins.</h1>
        <p>
          The server checked your Telegram ID against ADMIN_IDS and didn't find it. Ask the
          person who runs Taskon if you need access.
        </p>
        <AppLink to="/" className="btn btn--ghost">
          Back to Taskon
        </AppLink>
        <span className="admin-locked__fine">Points only. No token, no cash.</span>
      </div>
    );
  }

  return (
    <div className="admin">
      <header className="admin-head">
        <AppLink to="/" className="admin-back">
          <IconBack size={17} /> Back to Taskon
        </AppLink>
        <div className="admin-head__title">
          <p className="eyebrow">Taskon console</p>
          <h1>Admin</h1>
          <p>
            Signed in as{" "}
            {displayName({
              firstName: session.user.firstName,
              username: session.user.username,
              telegramId: session.user.telegramId,
            })}{" "}
            · ID {session.user.telegramId}
          </p>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Admin sections">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? "is-active" : ""}
            aria-current={tab === item.key ? "page" : undefined}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className="admin-body">
        {tab === "overview" ? (
          <OverviewPanel
            onOpenFlags={() => setTab("flags")}
            onOpenPeople={(query) => {
              setPeopleQuery(query);
              setTab("people");
            }}
          />
        ) : null}
        {tab === "tasks" ? <TasksPanel /> : null}
        {tab === "people" ? <PeoplePanel initialQuery={peopleQuery} /> : null}
        {tab === "flags" ? (
          <FlagsPanel
            onReview={(query) => {
              setPeopleQuery(query);
              setTab("people");
            }}
          />
        ) : null}
        {tab === "audit" ? <AuditPanel /> : null}
      </main>

      <footer className="admin-foot">
        <span>Taskon console</span>
        <span>Every change is logged.</span>
      </footer>
    </div>
  );
}
