import { useRef, useState } from "react";
import { StreakFlame } from "./StreakFlame";
import { IconCheck } from "./Icons";
import { formatPoints } from "../lib/format";
import { haptic } from "../lib/telegram";
import { errorMessage } from "../lib/errors";
import { useToast } from "../lib/toast";

interface CheckInPanelProps {
  available: boolean;
  doneToday: boolean;
  streak: number;
  reward: number;
  bonus: number;
  onCheckin: () => Promise<void>;
}

export function CheckInPanel({
  available,
  doneToday,
  streak,
  reward,
  bonus,
  onCheckin,
}: CheckInPanelProps) {
  const [busy, setBusy] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const { notify } = useToast();
  const timer = useRef<number | null>(null);

  async function checkIn() {
    if (!available || busy) return;
    setBusy(true);
    try {
      await onCheckin();
      haptic("success");
      setCelebrating(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCelebrating(false), 1400);
    } catch (error) {
      notify(errorMessage(error), "warn");
      haptic("warning");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`checkin ${doneToday ? "checkin--done" : ""}`}>
      <div className="checkin__flame">
        <StreakFlame streak={streak} lit={!doneToday} celebrating={celebrating} />
      </div>

      <div className="checkin__copy">
        <p className="eyebrow">Daily check-in</p>
        {doneToday ? (
          <>
            <h2>
              {streak} {streak === 1 ? "day" : "days"} running.
            </h2>
            <p>
              Come back tomorrow, your streak is at {streak}. Next check-in gives{" "}
              {formatPoints(reward)}.
            </p>
          </>
        ) : streak > 0 ? (
          <>
            <h2>Day {streak + 1} is waiting.</h2>
            <p>
              {formatPoints(reward)} points for showing up
              {bonus > 0 ? `, including ${formatPoints(bonus)} streak bonus.` : "."}
            </p>
          </>
        ) : (
          <>
            <h2>Start the streak.</h2>
            <p>One check-in a day. {formatPoints(reward)} points for the first one.</p>
          </>
        )}
      </div>

      <button
        type="button"
        className={`claim-btn ${doneToday ? "claim-btn--done" : ""} ${celebrating ? "is-popped" : ""}`}
        disabled={!available || busy}
        onClick={() => void checkIn()}
      >
        {doneToday ? (
          <>
            <IconCheck size={17} /> Checked in
          </>
        ) : busy ? (
          "Checking in…"
        ) : (
          <>Check in <span className="claim-btn__plus">+{formatPoints(reward)}</span></>
        )}
      </button>

      <span className="checkin__rule" aria-hidden="true" />
    </section>
  );
}
