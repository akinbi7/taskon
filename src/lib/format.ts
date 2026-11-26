import type { TaskType } from "../types";

const pointsFormatter = new Intl.NumberFormat("en-US");

export function formatPoints(value: number): string {
  return pointsFormatter.format(Math.round(value));
}

export function plural(count: number, one: string, many: string): string {
  return `${formatPoints(count)} ${count === 1 ? one : many}`;
}

export function typeLabel(type: TaskType | string): string {
  switch (type) {
    case "join_channel":
      return "Join a channel";
    case "visit_link":
      return "Visit a link";
    case "follow_x":
      return "Follow on X";
    case "partner":
      return "Partner task";
    default:
      return "Task";
  }
}

export function typeShort(type: TaskType | string): string {
  switch (type) {
    case "join_channel":
      return "Channel";
    case "visit_link":
      return "Visit";
    case "follow_x":
      return "X";
    case "partner":
      return "Partner";
    default:
      return "Task";
  }
}

export function typeHint(type: TaskType | string): string {
  switch (type) {
    case "join_channel":
      return "The bot checks that you joined.";
    case "visit_link":
      return "Stay on the page for a moment.";
    case "follow_x":
      return "Open the profile, then come back.";
    case "partner":
      return "A partner's link. The timer still applies.";
    default:
      return "";
  }
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function formatEyebrowDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function relativeDay(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

export function displayName(person: {
  firstName?: string | null;
  username?: string | null;
  telegramId?: number;
}): string {
  if (person.firstName) return person.firstName;
  if (person.username) return `@${person.username}`;
  if (person.telegramId) return `#${person.telegramId}`;
  return "A friend";
}

export function initials(name: string | null | undefined): string {
  const source = (name ?? "?").trim();
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

export function expiryNote(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `Closes ${formatDay(iso)}`;
}
