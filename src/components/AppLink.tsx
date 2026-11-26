import type { MouseEvent, ReactNode } from "react";
import { navigate } from "../lib/router";

interface AppLinkProps {
  to: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function AppLink({ to, children, className, ariaLabel }: AppLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  }

  return (
    <a href={to} className={className} onClick={handleClick} aria-label={ariaLabel}>
      {children}
    </a>
  );
}
