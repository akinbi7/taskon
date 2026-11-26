import { useEffect } from "react";
import { TabBar } from "./components/TabBar";
import { Gate, LoadingScreen } from "./components/Gate";
import { Home } from "./screens/Home";
import { Tasks } from "./screens/Tasks";
import { Friends } from "./screens/Friends";
import { Ranks } from "./screens/Ranks";
import { Admin } from "./screens/Admin";
import { isDemoMode } from "./lib/api";
import { useSession } from "./lib/session";
import { usePath } from "./lib/router";
import { useToast } from "./lib/toast";

export function App() {
  const path = usePath();
  const { session, loading, error, retry } = useSession();
  const { notify } = useToast();
  const demo = isDemoMode();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [path]);

  useEffect(() => {
    if (session?.welcomeBonus && session.welcomeBonus > 0) {
      notify(
        `The friend who sent you added ${session.welcomeBonus} points to your start.`,
        "good",
      );
    }
  }, [session?.welcomeBonus, notify]);

  const badge = demo ? <span className="demo-badge">Demo data</span> : null;

  if (path === "/admin") {
    return (
      <>
        {badge}
        <Admin />
      </>
    );
  }

  if (loading) {
    return (
      <>
        {badge}
        <LoadingScreen />
      </>
    );
  }

  if (error || !session) {
    return (
      <>
        {badge}
        <Gate error={error} onRetry={retry} />
      </>
    );
  }

  const screen =
    path === "/tasks" ? (
      <Tasks />
    ) : path === "/friends" ? (
      <Friends />
    ) : path === "/ranks" ? (
      <Ranks />
    ) : (
      <Home />
    );

  return (
    <>
      {badge}
      <div className={`app app--${path.replace("/", "") || "home"}`}>
        <main className="page" key={path}>
          {screen}
        </main>
        <TabBar />
      </div>
    </>
  );
}
