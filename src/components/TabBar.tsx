import { AppLink } from "./AppLink";
import { IconFriends, IconHome, IconRanks, IconTasks } from "./Icons";
import { useSession } from "../lib/session";
import { usePath } from "../lib/router";

const TABS = [
  { path: "/", label: "Today", icon: IconHome },
  { path: "/tasks", label: "Tasks", icon: IconTasks, badge: true },
  { path: "/friends", label: "Friends", icon: IconFriends },
  { path: "/ranks", label: "Board", icon: IconRanks },
];

export function TabBar() {
  const path = usePath();
  const { session } = useSession();
  const available = session?.counts.tasksAvailable ?? 0;

  return (
    <nav className="tabbar" aria-label="Main">
      <svg
        className="tabbar__edge"
        viewBox="0 0 360 8"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 5.1C34 2.2 66 6.2 103 4.6S166 1.4 204 4.1s77 2.4 156-1.6" />
      </svg>
      <div className="tabbar__inner">
        {TABS.map((tab) => {
          const active = tab.path === "/" ? path === "/" : path.startsWith(tab.path);
          const Icon = tab.icon;
          return (
            <AppLink
              key={tab.path}
              to={tab.path}
              className={`tab ${active ? "is-active" : ""}`}
              ariaLabel={tab.label}
            >
              <span className="tab__icon">
                <Icon size={21} />
                {tab.badge && available > 0 ? (
                  <span className="tab__count" aria-label={`${available} tasks waiting`}>
                    {available > 9 ? "9+" : available}
                  </span>
                ) : null}
              </span>
              <span className="tab__label">{tab.label}</span>
            </AppLink>
          );
        })}
      </div>
    </nav>
  );
}
