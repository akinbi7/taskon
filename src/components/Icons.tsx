import type { SVGProps } from "react";
import type { TaskType } from "../types";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number;
}

function base({ size = 22, className, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
    focusable: false,
    ...rest,
  };
}

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.4 11.5c2-2.2 5.3-5 8.7-8.1 3.3 3 6.5 5.6 8.5 7.9" />
      <path d="M5.3 9.7v10.6h13.5V9.5" />
      <path d="M9.9 20.3v-5.7h4.3v5.7" />
      <path d="M16.3 6.7V3.8" />
    </svg>
  );
}

export function IconTasks(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.1 3.5h8.6l4.1 3.9v12.9H6.1Z" />
      <path d="M14.5 3.7v4.1h4.1" />
      <path d="M8.7 12.1h5.9" />
      <path d="M8.7 15.3h3.7" />
      <path d="M8.7 18.2l1.5 1.3 3-3.1" />
    </svg>
  );
}

export function IconFriends(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9.1" cy="7.9" r="3.1" />
      <path d="M3.6 20.1c.3-3.7 2.5-5.9 5.5-5.9 2.9 0 5.1 2.1 5.5 5.9" />
      <path d="M15.1 5.4c1.9.2 3.2 1.5 3.3 3.2.2 1.7-.9 3.1-2.6 3.5" />
      <path d="M16.4 14.4c2.3.4 3.8 2.3 4 5.4" />
    </svg>
  );
}

export function IconRanks(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.2 20.2v-5.6h4.1v5.6" />
      <path d="M9.9 20.2V8.7h4.2v11.5" />
      <path d="M15.8 20.2v-8.3h4v8.3" />
      <path d="M3.4 20.4h17.3" />
      <path d="M11.9 5.2l.8-2.4 1 2.3 2.4.2-1.9 1.6.6 2.3-2-1.3-2.1 1.3.6-2.3-1.8-1.7Z" />
    </svg>
  );
}

export function IconCoin(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12.2 2.9c5 0 8.9 3.7 8.9 8.7 0 5.2-3.8 9.3-8.9 9.4-5.2.1-9.1-3.7-9.1-8.8 0-5 3.9-9.3 9.1-9.3Z" />
      <path d="M12.1 6.2c.7 2.3 1.8 3.4 4.1 4.1-2.3.8-3.4 1.9-4.1 4.2-.7-2.3-1.8-3.4-4-4.2 2.2-.7 3.3-1.8 4-4.1Z" />
    </svg>
  );
}

export function IconArrowUpRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5.6 18.2c2.5-4.8 5.8-8.1 11.2-11.6" />
      <path d="M11.3 6.2l6.2-.2.3 6.1" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.4 12.1c4.4-.3 8.8-.4 14.4-.3" />
      <path d="M14.1 7.1c1.4 1.6 2.7 3 4.6 4.7-1.9 1.5-3.2 2.9-4.6 4.5" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12.6c1.7 1.4 3.2 3.1 4.3 5.1 2.4-4.8 5.8-9.1 10.6-12.6" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12.1" r="8.5" />
      <path d="M12.1 7.2v5.1l3.4 2" />
    </svg>
  );
}

export function IconChannel(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.1 9.8v4.4h3.2l5 3.8V5.9l-5 3.9Z" />
      <path d="M15.7 8.7c1.4 1.4 1.4 5.1 0 6.6" />
      <path d="M18.2 6.3c2.5 2.6 2.4 8.6-.1 11.2" />
    </svg>
  );
}

export function IconLink(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9.7 14.5l4.8-4.9" />
      <path d="M7.8 16.4c-2.2 2.2-4.9 0-3.1-2.3l2.5-2.4c1.6-1.6 3.1-1.5 4.2-.4" />
      <path d="M16.5 7.7c2.2-2.2 4.9 0 3 2.3l-2.4 2.3c-1.6 1.6-3 1.5-4.1.5" />
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5.1 4.5l13.6 15" />
      <path d="M18.7 4.3L5.2 19.6" />
      <path d="M4.4 4.6l.4-.2M19.2 19l.3-.1" />
    </svg>
  );
}

export function IconPartner(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9.2" cy="12" r="5.7" />
      <circle cx="14.8" cy="12" r="5.7" />
      <path d="M12 7.7c.9 1.6.9 7 0 8.6" />
    </svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8.4 8.3h10.5v11.8H8.4Z" />
      <path d="M5.4 16.1V4.3h10.6" />
    </svg>
  );
}

export function IconShare(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20.2 3.7L3.8 10.5l6.2 2.5 2.4 6.3Z" />
      <path d="M20.1 3.8l-9.7 9.2" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10.8" cy="10.6" r="6.5" />
      <path d="M15.5 15.4c1.6 1.5 2.9 2.8 4.4 4.6" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5.6 5.2l12.8 13.2" />
      <path d="M18.5 5.1L5.4 18.7" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4.3v15.4" />
      <path d="M4.4 12.1h15.3" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.8 6.9h14.4" />
      <path d="M9.2 6.8V4.4h5.5v2.4" />
      <path d="M6.6 7.2l1 13.2h8.9l1-13.1" />
      <path d="M10.3 10.6l.3 6M13.7 10.5l-.3 6.1" />
    </svg>
  );
}

export function IconBan(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M6.1 17.9c3.8-3.9 7.7-7.7 11.7-11.7" />
    </svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5.4 10.4h13.2v9.5H5.4Z" />
      <path d="M8.1 10.2V7.4c0-4.7 7.6-4.8 7.7 0v2.8" />
      <path d="M12.1 14.2v2.1" />
    </svg>
  );
}

export function IconBack(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19.5 12.1c-4.7.2-9.3.2-14.8 0" />
      <path d="M9.5 7.2C8 8.8 6.8 10 4.8 11.9c1.9 1.7 3.2 3 4.8 4.8" />
    </svg>
  );
}

export function IconFlag(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.2 20.6V3.7" />
      <path d="M6.4 4.5c3.2-1.7 6 1.6 9.1.2 1-.4 1.7-.7 2.6-.8v7.3c-4.6.8-7.3-1.9-11.6-.1" />
    </svg>
  );
}

export function IconFlame(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12.4 2.8c.9 4 5.3 5.8 5.2 10.6-.1 4.6-2.7 7.4-5.7 7.4-3.1 0-5.3-2.5-5.2-6.1.1-3.1 2.1-5.1 3.5-8.1.5-1 .8-2.2 2.2-3.8Z" />
      <path d="M12.1 12.1c.6 1.5 2.2 2.4 2.1 4.4-.1 1.8-1 2.9-2.2 2.9-1.4 0-2.3-1.1-2.2-2.7.1-1.7 1.4-2.8 2.3-4.6Z" />
    </svg>
  );
}

export function TaskGlyph({
  type,
  ...props
}: IconProps & { type: TaskType | string }) {
  switch (type) {
    case "join_channel":
      return <IconChannel {...props} />;
    case "follow_x":
      return <IconX {...props} />;
    case "partner":
      return <IconPartner {...props} />;
    default:
      return <IconLink {...props} />;
  }
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`wordmark ${className ?? ""}`}>
      Taskon<span className="wordmark__tick" aria-hidden="true" />
    </span>
  );
}
