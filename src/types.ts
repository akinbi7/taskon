export type TaskType = "join_channel" | "visit_link" | "follow_x" | "partner";
export type TaskStatus = "available" | "started" | "completed";

export interface SessionUser {
  id: string;
  telegramId: number;
  username: string | null;
  firstName: string | null;
  points: number;
  streak: number;
  lastCheckin: string | null;
  isAdmin: boolean;
}

export interface ReferralPerson {
  firstName: string | null;
  username: string | null;
  joinedAt: string;
}

export interface SessionData {
  user: SessionUser;
  checkin: {
    available: boolean;
    doneToday: boolean;
    streak: number;
    projectedStreak: number;
    base: number;
    bonus: number;
    reward: number;
  };
  counts: {
    tasksAvailable: number;
    tasksCompleted: number;
    referrals: number;
    referralEarnings: number;
  };
  rank: { position: number | null; total: number };
  referral: {
    code: string;
    link: string;
    referrerBonus: number;
    referredBonus: number;
    invited: number;
    earned: number;
    recent: ReferralPerson[];
  };
  nextTasks: Array<{ id: string; title: string; reward: number; type: TaskType }>;
  welcomeBonus: number;
}

export interface TaskItem {
  id: string;
  title: string;
  type: TaskType;
  reward: number;
  url: string;
  timerSeconds: number;
  expiresAt: string | null;
  status: TaskStatus;
  startedAt?: string;
  claimAt?: string;
  completedAt?: string;
}

export interface StartResult {
  startedAt: string;
  timerSeconds: number;
  claimAt: string;
}

export interface ClaimResult {
  points: number;
  reward: number;
}

export interface LeaderboardRow {
  position: number;
  telegramId: number;
  username: string | null;
  firstName: string | null;
  points: number;
  isMe: boolean;
}

export interface LeaderboardData {
  top: LeaderboardRow[];
  me: LeaderboardRow | null;
  total: number;
}

export interface ReferralsData {
  referral: SessionData["referral"];
  counts: SessionData["counts"];
}

export interface AdminOverview {
  total_users: number;
  banned_users: number;
  new_today: number;
  active_today: number;
  total_points: number;
  points_today: number;
  checkins_today: number;
  tasks_today: number;
  referrals_today: number;
  flags_count: number;
  top_referrers: Array<{
    telegram_id: number;
    username: string | null;
    first_name: string | null;
    refs: number;
  }>;
  top_tasks: Array<{ title: string; type: TaskType; completions: number }>;
}

export interface AdminTask {
  id: string;
  title: string;
  type: TaskType;
  reward: number;
  url: string;
  active: boolean;
  timerSeconds: number;
  expiresAt: string | null;
  createdAt: string;
  completions: number;
}

export interface AdminUser {
  id: string;
  telegramId: number;
  username: string | null;
  firstName: string | null;
  points: number;
  streak: number;
  banned: boolean;
  banReason: string | null;
  referrals: number;
  referralEarnings: number;
  tasksDone: number;
  lastSeenAt: string;
  createdAt: string;
}

export interface AdminFlag {
  userId: string;
  telegramId: number;
  username: string | null;
  firstName: string | null;
  flags: string[];
  refs24h: number;
  refs1h: number;
  sameSecondClaims: number;
  points: number;
  lastSeenAt: string;
}

export interface AuditEntry {
  id: number;
  adminTelegramId: number;
  action: string;
  reason: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  targetUsername: string | null;
  targetTaskTitle: string | null;
}
