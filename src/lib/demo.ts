// Local preview adapter. Enabled only with VITE_DEMO=1 outside Telegram.
// It mimics the Edge Function's contract so the UI can be exercised at 360px.
import { ApiError } from "./errors";
import type {
  AdminFlag,
  AdminOverview,
  AdminTask,
  AdminUser,
  AuditEntry,
  ClaimResult,
  LeaderboardData,
  LeaderboardRow,
  ReferralsData,
  SessionData,
  StartResult,
  TaskItem,
  TaskType,
} from "../types";

const STORAGE_KEY = "taskon.demo.v2";
const ME_TELEGRAM_ID = 700001;
const BOT = import.meta.env.VITE_BOT_USERNAME || "taskon_demo_bot";

interface DemoPerson {
  id: string;
  telegramId: number;
  username: string | null;
  firstName: string | null;
  points: number;
  streak: number;
  lastCheckin: string | null;
  banned: boolean;
  banReason: string | null;
  refs1h: number;
  refs24h: number;
  sameSecondClaims: number;
  tasksDone: number;
  referralEarnings: number;
  lastSeenAt: string;
  createdAt: string;
}

interface DemoTask {
  id: string;
  title: string;
  type: TaskType;
  reward: number;
  url: string;
  timerSeconds: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
  completions: number;
}

interface DemoReferral {
  firstName: string;
  username: string;
  joinedAt: string;
}

interface DemoState {
  version: 2;
  people: DemoPerson[];
  tasks: DemoTask[];
  completed: Record<string, string>;
  starts: Record<string, string>;
  referrals: DemoReferral[];
  audit: AuditEntry[];
  nextAuditId: number;
}

let memoryState: DemoState | null = null;

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const dayAgo = (days: number) => ago(days * 86_400_000);
const todayString = () => new Date().toISOString().slice(0, 10);

function seed(): DemoState {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const me: DemoPerson = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    telegramId: ME_TELEGRAM_ID,
    username: "nadia",
    firstName: "Nadia",
    points: 1240,
    streak: 4,
    lastCheckin: yesterday,
    banned: false,
    banReason: null,
    refs1h: 0,
    refs24h: 0,
    sameSecondClaims: 0,
    tasksDone: 7,
    referralEarnings: 150,
    lastSeenAt: new Date().toISOString(),
    createdAt: dayAgo(64),
  };

  const others: DemoPerson[] = [
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      telegramId: 700002,
      username: "ada",
      firstName: "Ada Winters",
      points: 2380,
      streak: 19,
      lastCheckin: yesterday,
      banned: false,
      banReason: null,
      refs1h: 0,
      refs24h: 2,
      sameSecondClaims: 0,
      tasksDone: 31,
      referralEarnings: 200,
      lastSeenAt: ago(3_600_000),
      createdAt: dayAgo(58),
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      telegramId: 700003,
      username: "miko",
      firstName: "Miko",
      points: 480,
      streak: 2,
      lastCheckin: todayString(),
      banned: false,
      banReason: null,
      refs1h: 0,
      refs24h: 0,
      sameSecondClaims: 0,
      tasksDone: 4,
      referralEarnings: 0,
      lastSeenAt: ago(1_800_000),
      createdAt: dayAgo(9),
    },
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      telegramId: 700004,
      username: "jorivers",
      firstName: "Jo Rivers",
      points: 910,
      streak: 6,
      lastCheckin: yesterday,
      banned: false,
      banReason: null,
      refs1h: 9,
      refs24h: 27,
      sameSecondClaims: 0,
      tasksDone: 12,
      referralEarnings: 450,
      lastSeenAt: ago(900_000),
      createdAt: dayAgo(2),
    },
    {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      telegramId: 700005,
      username: "priya",
      firstName: "Priya",
      points: 1500,
      streak: 11,
      lastCheckin: yesterday,
      banned: false,
      banReason: null,
      refs1h: 1,
      refs24h: 3,
      sameSecondClaims: 2,
      tasksDone: 41,
      referralEarnings: 100,
      lastSeenAt: ago(7_200_000),
      createdAt: dayAgo(21),
    },
    {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      telegramId: 700006,
      username: "kai",
      firstName: "Kai",
      points: 0,
      streak: 0,
      lastCheckin: null,
      banned: true,
      banReason: "Duplicate account, same device as @jorivers",
      refs1h: 0,
      refs24h: 0,
      sameSecondClaims: 0,
      tasksDone: 0,
      referralEarnings: 0,
      lastSeenAt: dayAgo(3),
      createdAt: dayAgo(3),
    },
  ];

  const tasks: DemoTask[] = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Join the Taskon notes channel",
      type: "join_channel",
      reward: 60,
      url: "https://t.me/taskonnotes",
      timerSeconds: 20,
      active: true,
      expiresAt: null,
      createdAt: dayAgo(2),
      completions: 12,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Read what Taskon is and isn't",
      type: "visit_link",
      reward: 30,
      url: "https://example.com/taskon-notes",
      timerSeconds: 8,
      active: true,
      expiresAt: null,
      createdAt: dayAgo(1),
      completions: 28,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      title: "Follow the studio on X",
      type: "follow_x",
      reward: 40,
      url: "https://x.com/taskon",
      timerSeconds: 10,
      active: true,
      expiresAt: null,
      createdAt: ago(7_200_000),
      completions: 9,
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      title: "Try the partner's morning list",
      type: "partner",
      reward: 50,
      url: "https://example.com/morning-list",
      timerSeconds: 12,
      active: true,
      expiresAt: null,
      createdAt: ago(3_600_000),
      completions: 4,
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      title: "Join the announcements channel",
      type: "join_channel",
      reward: 60,
      url: "https://t.me/taskonannouncements",
      timerSeconds: 20,
      active: true,
      expiresAt: null,
      createdAt: dayAgo(6),
      completions: 33,
    },
    {
      id: "66666666-6666-4666-8666-666666666666",
      title: "Old summer reading list",
      type: "visit_link",
      reward: 25,
      url: "https://example.com/summer",
      timerSeconds: 10,
      active: false,
      expiresAt: null,
      createdAt: dayAgo(40),
      completions: 51,
    },
  ];

  const completed: Record<string, string> = {
    "55555555-5555-4555-8555-555555555555": dayAgo(1),
  };

  const referrals: DemoReferral[] = [
    { firstName: "Miko", username: "miko", joinedAt: dayAgo(1) },
    { firstName: "Ada Winters", username: "ada", joinedAt: dayAgo(4) },
    { firstName: "Sam", username: "samo", joinedAt: dayAgo(12) },
  ];

  const audit: AuditEntry[] = [
    {
      id: 3,
      adminTelegramId: ME_TELEGRAM_ID,
      action: "task.create",
      reason: null,
      details: { title: "Try the partner's morning list", reward: 50 },
      createdAt: ago(3_600_000),
      targetUsername: null,
      targetTaskTitle: null,
    },
    {
      id: 2,
      adminTelegramId: ME_TELEGRAM_ID,
      action: "user.ban",
      reason: "Duplicate account, same device as @jorivers",
      details: { username: "kai", banned: true },
      createdAt: dayAgo(3),
      targetUsername: "kai",
      targetTaskTitle: null,
    },
    {
      id: 1,
      adminTelegramId: ME_TELEGRAM_ID,
      action: "user.adjust_points",
      reason: "Fixing a missed referral bonus",
      details: { applied_delta: 50, points_before: 1190, points_after: 1240 },
      createdAt: dayAgo(6),
      targetUsername: "nadia",
      targetTaskTitle: null,
    },
  ];

  return {
    version: 2,
    people: [me, ...others],
    tasks,
    completed,
    starts: {},
    referrals,
    audit,
    nextAuditId: 4,
  };
}

function loadState(): DemoState {
  if (memoryState) return memoryState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed.version === 2 && Array.isArray(parsed.people)) {
        memoryState = parsed;
        return parsed;
      }
    }
  } catch {
    /* storage may be blocked */
  }
  memoryState = seed();
  saveState(memoryState);
  return memoryState;
}

function saveState(state: DemoState) {
  memoryState = state;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* keep it in memory */
  }
}

function me(state: DemoState): DemoPerson {
  const person = state.people.find((item) => item.telegramId === ME_TELEGRAM_ID);
  if (!person) throw new ApiError("user_not_found", "Demo user is missing.");
  return person;
}

function availableTasks(state: DemoState): DemoTask[] {
  const now = Date.now();
  return state.tasks.filter(
    (task) =>
      task.active &&
      !state.completed[task.id] &&
      (!task.expiresAt || new Date(task.expiresAt).getTime() > now),
  );
}

const EXTRA_NAMES = [
  "Lena Ortiz",
  "Tomás Vidal",
  "Iris Chen",
  "Bilal Haddad",
  "Noor Rahman",
  "Elias Berg",
  "Sofia Marchetti",
  "Ravi Menon",
  "June Park",
  "Ola Nordmann",
  "Marta Kowalska",
  "Hugo Laurent",
  "Ava Brooks",
  "Deniz Yilmaz",
  "Sana Iqbal",
  "Piotr Nowak",
  "Maeve Kelly",
  "Andrés Rojas",
  "Yuki Sato",
  "Selin Kaya",
  "Nina Petrova",
  "Omar Farouk",
  "Clara Jensen",
  "Theo Martin",
  "Lucia Rossi",
  "Arjun Patel",
  "Freya Holm",
  "Karim Aziz",
  "Emma Novak",
  "Tali Ben-Ami",
];

function allRanked(state: DemoState): LeaderboardRow[] {
  const rows: Array<Omit<LeaderboardRow, "position">> = state.people
    .filter((person) => !person.banned)
    .map((person) => ({
      telegramId: person.telegramId,
      username: person.username,
      firstName: person.firstName,
      points: person.points,
      isMe: person.telegramId === ME_TELEGRAM_ID,
    }));

  EXTRA_NAMES.forEach((name, index) => {
    rows.push({
      telegramId: 800100 + index,
      username: name.toLowerCase().replace(/[^a-z]/g, ""),
      firstName: name,
      points: 4200 - index * 118,
      isMe: false,
    });
  });

  return rows
    .sort((a, b) => b.points - a.points || a.telegramId - b.telegramId)
    .map((row, index) => ({ ...row, position: index + 1 }));
}

function session(state: DemoState): SessionData {
  const person = me(state);
  const today = todayString();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const doneToday = person.lastCheckin === today;
  const projected = doneToday
    ? person.streak + 1
    : person.lastCheckin === yesterday
      ? person.streak + 1
      : 1;
  const bonus = Math.min(Math.max(projected - 1, 0) * 2, 10);
  const available = availableTasks(state);
  const ranked = allRanked(state);
  const meRow = ranked.find((row) => row.isMe) ?? null;
  const earnings = state.referrals.length * 50;

  return {
    user: {
      id: person.id,
      telegramId: person.telegramId,
      username: person.username,
      firstName: person.firstName,
      points: person.points,
      streak: person.streak,
      lastCheckin: person.lastCheckin,
      isAdmin: true,
    },
    checkin: {
      available: !doneToday,
      doneToday,
      streak: person.streak,
      projectedStreak: projected,
      base: 10,
      bonus,
      reward: 10 + bonus,
    },
    counts: {
      tasksAvailable: available.length,
      tasksCompleted: person.tasksDone,
      referrals: state.referrals.length,
      referralEarnings: earnings,
    },
    rank: { position: meRow?.position ?? null, total: 2140 },
    referral: {
      code: String(person.telegramId),
      link: `https://t.me/${BOT}?startapp=ref_${person.telegramId}`,
      referrerBonus: 50,
      referredBonus: 25,
      invited: state.referrals.length,
      earned: earnings,
      recent: state.referrals.slice(0, 5),
    },
    nextTasks: available.slice(0, 2).map((task) => ({
      id: task.id,
      title: task.title,
      reward: task.reward,
      type: task.type,
    })),
    welcomeBonus: 0,
  };
}

function taskViews(state: DemoState): TaskItem[] {
  const now = Date.now();
  return state.tasks
    .filter((task) => {
      if (state.completed[task.id]) return true;
      return task.active && (!task.expiresAt || new Date(task.expiresAt).getTime() > now);
    })
    .map((task) => {
      const completedAt = state.completed[task.id];
      const startedAt = state.starts[task.id];
      const timerSeconds = task.type === "join_channel" ? 0 : task.timerSeconds;
      return {
        id: task.id,
        title: task.title,
        type: task.type,
        reward: task.reward,
        url: task.url,
        timerSeconds,
        expiresAt: task.expiresAt,
        status: completedAt ? "completed" : startedAt ? "started" : "available",
        startedAt,
        claimAt: startedAt
          ? new Date(new Date(startedAt).getTime() + timerSeconds * 1000).toISOString()
          : undefined,
        completedAt,
      } as TaskItem;
    })
    .sort((a, b) => {
      const rank = { available: 0, started: 1, completed: 2 };
      return rank[a.status] - rank[b.status];
    });
}

function findTask(state: DemoState, id: unknown): DemoTask {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) throw new ApiError("task_unavailable", "This task isn't open anymore.");
  return task;
}

function audit(
  state: DemoState,
  action: string,
  options: {
    reason?: string | null;
    targetUsername?: string | null;
    targetTaskTitle?: string | null;
    details?: Record<string, unknown>;
  } = {},
) {
  state.audit.unshift({
    id: state.nextAuditId++,
    adminTelegramId: ME_TELEGRAM_ID,
    action,
    reason: options.reason ?? null,
    details: options.details ?? {},
    createdAt: new Date().toISOString(),
    targetUsername: options.targetUsername ?? null,
    targetTaskTitle: options.targetTaskTitle ?? null,
  });
}

function adminUsers(state: DemoState): AdminUser[] {
  return state.people.map((person) => ({
    id: person.id,
    telegramId: person.telegramId,
    username: person.username,
    firstName: person.firstName,
    points: person.points,
    streak: person.streak,
    banned: person.banned,
    banReason: person.banReason,
    referrals: person.telegramId === ME_TELEGRAM_ID ? state.referrals.length : person.refs24h,
    referralEarnings:
      person.telegramId === ME_TELEGRAM_ID ? state.referrals.length * 50 : person.referralEarnings,
    tasksDone: person.telegramId === ME_TELEGRAM_ID ? person.tasksDone : person.tasksDone,
    lastSeenAt: person.lastSeenAt,
    createdAt: person.createdAt,
  }));
}

function flagList(state: DemoState): AdminFlag[] {
  return state.people
    .filter(
      (person) => person.refs1h >= 8 || person.refs24h >= 25 || person.sameSecondClaims > 0,
    )
    .map((person) => {
      const flags: string[] = [];
      if (person.refs1h >= 8) flags.push("referral_burst");
      if (person.refs24h >= 25) flags.push("referral_volume");
      if (person.sameSecondClaims > 0) flags.push("same_second_claims");
      return {
        userId: person.id,
        telegramId: person.telegramId,
        username: person.username,
        firstName: person.firstName,
        flags,
        refs24h: person.refs24h,
        refs1h: person.refs1h,
        sameSecondClaims: person.sameSecondClaims,
        points: person.points,
        lastSeenAt: person.lastSeenAt,
      };
    });
}

function overview(state: DemoState): AdminOverview {
  const today = todayString();
  const completionsToday = Object.entries(state.completed).filter(([, at]) =>
    at.startsWith(today),
  );
  const pointsToday = completionsToday.reduce((sum, [taskId]) => {
    const task = state.tasks.find((item) => item.id === taskId);
    return sum + (task?.reward ?? 0);
  }, 0) + (me(state).lastCheckin === today ? 10 + Math.min(Math.max(me(state).streak - 1, 0) * 2, 10) : 0);

  const topReferrers = [...state.people]
    .sort((a, b) => b.refs24h - a.refs24h)
    .slice(0, 5)
    .map((person) => ({
      telegram_id: person.telegramId,
      username: person.username,
      first_name: person.firstName,
      refs: person.refs24h,
    }));

  const topTasks = [...state.tasks]
    .sort((a, b) => b.completions - a.completions)
    .slice(0, 5)
    .map((task) => ({
      title: task.title,
      type: task.type,
      completions: task.completions,
    }));

  return {
    total_users: 2140,
    banned_users: state.people.filter((person) => person.banned).length,
    new_today: 14,
    active_today: state.people.filter(
      (person) => Date.now() - new Date(person.lastSeenAt).getTime() < 86_400_000,
    ).length,
    total_points: state.people.reduce((sum, person) => sum + person.points, 0),
    points_today: pointsToday,
    checkins_today: 1,
    tasks_today: completionsToday.length,
    referrals_today: 2,
    flags_count: flagList(state).length,
    top_referrers: topReferrers,
    top_tasks: topTasks,
  };
}

function adminTaskView(task: DemoTask): AdminTask {
  return {
    id: task.id,
    title: task.title,
    type: task.type,
    reward: task.reward,
    url: task.url,
    active: task.active,
    timerSeconds: task.timerSeconds,
    expiresAt: task.expiresAt,
    createdAt: task.createdAt,
    completions: task.completions,
  };
}

export async function demoCall<T>(
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const state = loadState();
  // Let the UI press its buttons: small pause mirrors a network round trip.
  await new Promise((resolve) => setTimeout(resolve, 140));
  const result = (): unknown => {
    switch (action) {
      case "session":
        return session(state);

      case "checkin": {
        const person = me(state);
        const today = todayString();
        if (person.lastCheckin === today) {
          throw new ApiError(
            "already_checked_in",
            "You already checked in today. The next one opens after midnight UTC.",
          );
        }
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
        const newStreak = person.lastCheckin === yesterday ? person.streak + 1 : 1;
        const bonus = Math.min(Math.max(newStreak - 1, 0) * 2, 10);
        const reward = 10 + bonus;
        person.points += reward;
        person.streak = newStreak;
        person.lastCheckin = today;
        person.lastSeenAt = new Date().toISOString();
        saveState(state);
        return { points: person.points, streak: newStreak, reward, bonus };
      }

      case "tasks.list":
        return taskViews(state);

      case "tasks.start": {
        const task = findTask(state, payload.taskId);
        if (!task.active) throw new ApiError("task_unavailable", "This task isn't open anymore.");
        if (state.completed[task.id]) {
          throw new ApiError("task_already_completed", "You already collected this one.");
        }
        if (!state.starts[task.id]) state.starts[task.id] = new Date().toISOString();
        const starts = state.starts[task.id];
        const timerSeconds = task.type === "join_channel" ? 0 : task.timerSeconds;
        saveState(state);
        return {
          startedAt: starts,
          timerSeconds,
          claimAt: new Date(new Date(starts).getTime() + timerSeconds * 1000).toISOString(),
        } satisfies StartResult;
      }

      case "tasks.claim": {
        const task = findTask(state, payload.taskId);
        const person = me(state);
        if (state.completed[task.id]) {
          throw new ApiError("task_already_completed", "You already collected this one.");
        }
        const startedAt = state.starts[task.id];
        if (!startedAt) {
          throw new ApiError("task_not_started", "Open the task first, then come back to claim it.");
        }
        if (task.type !== "join_channel") {
          const readyAt = new Date(startedAt).getTime() + task.timerSeconds * 1000;
          if (Date.now() < readyAt) {
            throw new ApiError("too_soon", "Not yet — the clock is still running on this one.");
          }
        }
        state.completed[task.id] = new Date().toISOString();
        delete state.starts[task.id];
        task.completions += 1;
        person.points += task.reward;
        person.tasksDone += 1;
        person.lastSeenAt = new Date().toISOString();
        saveState(state);
        return { points: person.points, reward: task.reward } satisfies ClaimResult;
      }

      case "referrals":
        return {
          referral: session(state).referral,
          counts: session(state).counts,
        } satisfies ReferralsData;

      case "leaderboard": {
        const ranked = allRanked(state);
        return {
          top: ranked.filter((row) => row.position <= 100),
          me: ranked.find((row) => row.isMe) ?? null,
          total: 2140,
        } satisfies LeaderboardData;
      }

      case "admin.overview":
        return overview(state);

      case "admin.tasks.list":
        return [...state.tasks]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(adminTaskView);

      case "admin.tasks.save": {
        const title = String(payload.title ?? "").trim();
        const type = String(payload.type ?? "") as TaskType;
        const reward = Math.trunc(Number(payload.reward));
        const url = String(payload.url ?? "").trim();
        const timerSeconds = Math.trunc(Number(payload.timerSeconds ?? 20));
        const expiresAt = payload.expiresAt ? new Date(String(payload.expiresAt)).toISOString() : null;
        if (title.length < 3) throw new ApiError("invalid_title", "Give the task a proper title.");
        if (reward < 1 || reward > 10000) {
          throw new ApiError("invalid_reward", "The reward has to be between 1 and 10,000 points.");
        }
        if (!/^https?:\/\//.test(url) && !url.startsWith("@")) {
          throw new ApiError("invalid_url", "That link doesn't look right.");
        }
        if (payload.id) {
          const task = findTask(state, payload.id);
          Object.assign(task, { title, type, reward, url, timerSeconds, expiresAt });
          audit(state, "task.edit", {
            targetTaskTitle: title,
            details: { reward, type, url },
          });
          saveState(state);
          return { id: task.id };
        }
        const task: DemoTask = {
          id: crypto.randomUUID(),
          title,
          type,
          reward,
          url,
          timerSeconds,
          active: true,
          expiresAt,
          createdAt: new Date().toISOString(),
          completions: 0,
        };
        state.tasks.push(task);
        audit(state, "task.create", {
          targetTaskTitle: title,
          details: { reward, type, url },
        });
        saveState(state);
        return { id: task.id };
      }

      case "admin.tasks.toggle": {
        const task = findTask(state, payload.id);
        task.active = Boolean(payload.active);
        audit(state, task.active ? "task.enable" : "task.disable", {
          targetTaskTitle: task.title,
          details: { active: task.active },
        });
        saveState(state);
        return { id: task.id, active: task.active };
      }

      case "admin.tasks.delete": {
        const task = findTask(state, payload.id);
        audit(state, "task.delete", {
          targetTaskTitle: task.title,
          details: { task_id: task.id, reward: task.reward, completions: task.completions },
        });
        state.tasks = state.tasks.filter((item) => item.id !== task.id);
        saveState(state);
        return { id: task.id };
      }

      case "admin.users.search": {
        const query = String(payload.query ?? "").trim().toLowerCase();
        return adminUsers(state).filter((person) => {
          if (!query) return true;
          return (
            String(person.telegramId).includes(query) ||
            (person.username ?? "").toLowerCase().includes(query) ||
            (person.firstName ?? "").toLowerCase().includes(query)
          );
        });
      }

      case "admin.users.adjust": {
        const person = state.people.find((item) => item.id === payload.userId);
        if (!person) throw new ApiError("user_not_found", "We couldn't find that account.");
        const delta = Math.trunc(Number(payload.delta));
        const reason = String(payload.reason ?? "").trim();
        if (!Number.isFinite(delta) || delta === 0) {
          throw new ApiError("invalid_delta", "Enter a point change that isn't zero.");
        }
        if (reason.length < 3) {
          throw new ApiError("reason_required", "Add a short reason before saving.");
        }
        const before = person.points;
        person.points = Math.max(0, before + delta);
        audit(state, "user.adjust_points", {
          targetUsername: person.username,
          reason,
          details: { applied_delta: person.points - before, points_before: before, points_after: person.points },
        });
        saveState(state);
        return { points: person.points };
      }

      case "admin.users.ban": {
        const person = state.people.find((item) => item.id === payload.userId);
        if (!person) throw new ApiError("user_not_found", "We couldn't find that account.");
        if (person.telegramId === ME_TELEGRAM_ID) {
          throw new ApiError("cannot_ban_self", "You can't ban your own account.");
        }
        const banned = Boolean(payload.banned);
        const reason = String(payload.reason ?? "").trim();
        if (banned && reason.length < 3) {
          throw new ApiError("reason_required", "Add a short reason for the ban.");
        }
        person.banned = banned;
        person.banReason = banned ? reason : null;
        audit(state, banned ? "user.ban" : "user.unban", {
          targetUsername: person.username,
          reason: reason || null,
          details: { banned },
        });
        saveState(state);
        return { id: person.id, banned };
      }

      case "admin.flags":
        return flagList(state);

      case "admin.audit":
        return [...state.audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      default:
        throw new ApiError("bad_request", "Unknown action.");
    }
  };
  return result() as T;
}
