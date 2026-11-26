import { AppLink } from "../components/AppLink";
import { CheckInPanel } from "../components/CheckInPanel";
import { PointsCountUp } from "../components/PointsCountUp";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconCoin,
  TaskGlyph,
} from "../components/Icons";
import { apiCall } from "../lib/api";
import { useSession } from "../lib/session";
import { useToast } from "../lib/toast";
import {
  formatEyebrowDate,
  formatPoints,
  greeting,
  plural,
  typeShort,
} from "../lib/format";
export function Home() {
  const { session, refresh } = useSession();
  const { notify } = useToast();
  if (!session) return null;

  const { user, checkin, counts, rank, nextTasks } = session;
  const name = (user.firstName ?? user.username ?? "there").split(" ")[0];

  async function checkIn() {
    const result = await apiCall<{
      points: number;
      streak: number;
      reward: number;
      bonus: number;
    }>("checkin");
    try {
      await refresh();
    } catch {
      /* the points are already banked; the next open will catch up */
    }
    notify(`Day ${result.streak}. ${formatPoints(result.reward)} points added.`, "good");
  }

  return (
    <div className="screen screen--home">
      <header className="masthead">
        <div>
          <p className="eyebrow">{formatEyebrowDate()}</p>
          <h1>
            {greeting()}, <span>{name}.</span>
          </h1>
        </div>
        {user.isAdmin ? (
          <AppLink to="/admin" className="quiet-link">
            Console
          </AppLink>
        ) : null}
      </header>

      <section className="points-block" aria-label="Your points">
        <div className="points-block__top">
          <p className="label">Your points</p>
          <AppLink to="/ranks" className="rank-link">
            {rank.position ? `No. ${formatPoints(rank.position)}` : "Unranked"}
            <IconArrowUpRight size={14} />
          </AppLink>
        </div>
        <div className="points-block__figure">
          <PointsCountUp value={user.points} className="points-block__number" />
          <span className="points-block__coin" aria-hidden="true">
            <IconCoin size={58} />
          </span>
        </div>
        <p className="points-block__foot">
          {plural(counts.tasksCompleted, "task", "tasks")} finished
          <span className="dot" aria-hidden="true">·</span>
          {plural(counts.referrals, "friend", "friends")} brought in
        </p>
      </section>

      <CheckInPanel
        available={checkin.available}
        doneToday={checkin.doneToday}
        streak={checkin.streak}
        reward={checkin.reward}
        bonus={checkin.bonus}
        onCheckin={checkIn}
      />

      {session.welcomeBonus > 0 ? (
        <p className="aside-note">
          The link that brought you here added {formatPoints(session.welcomeBonus)} points to
          your start.
        </p>
      ) : null}

      <section className="next-up">
        <div className="section-head">
          <h2>Worth doing</h2>
          <AppLink to="/tasks" className="section-head__link">
            All tasks <IconArrowRight size={15} />
          </AppLink>
        </div>

        {nextTasks.length > 0 ? (
          <div className="next-list">
            {nextTasks.map((task) => (
              <AppLink key={task.id} to="/tasks" className="next-task">
                <span className="next-task__glyph">
                  <TaskGlyph type={task.type} size={19} />
                </span>
                <span className="next-task__body">
                  <span className="next-task__title">{task.title}</span>
                  <span className="next-task__meta">
                    {typeShort(task.type)} <span className="dot">·</span>{" "}
                    {formatPoints(task.reward)} points
                  </span>
                </span>
                <IconArrowUpRight size={16} />
              </AppLink>
            ))}
          </div>
        ) : (
          <p className="empty-line">
            Nothing waiting right now. New tasks usually land in the morning.
          </p>
        )}
      </section>

      <footer className="home-foot">
        <p className="home-foot__rule" aria-hidden="true" />
        <p>
          Points are a score, not money. There's no token, nothing to buy, and nothing to
          cash out.
        </p>
      </footer>
    </div>
  );
}
