import { IconArrowUpRight, IconCoin, IconCopy, IconFriends, IconShare } from "../components/Icons";
import { useSession } from "../lib/session";
import { useToast } from "../lib/toast";
import { copyText, haptic, shareLink } from "../lib/telegram";
import { displayName, formatPoints, initials, relativeDay } from "../lib/format";

export function Friends() {
  const { session } = useSession();
  const { notify } = useToast();
  if (!session) return null;

  const { referral } = session;
  const ready = Boolean(referral.link);

  async function copy() {
    if (!referral.link) return;
    const copied = await copyText(referral.link);
    haptic(copied ? "success" : "warning");
    notify(
      copied ? "Link copied. Send it to one person, not a group." : "Couldn't copy. Long-press the link instead.",
      copied ? "good" : "warn",
    );
  }

  function share() {
    if (!referral.link) return;
    haptic("light");
    shareLink(
      referral.link,
      `I'm collecting points on Taskon. Small tasks, one check-in a day. Use my link and you start with ${referral.referredBonus} points.`,
    );
  }

  return (
    <div className="screen screen--friends">
      <header className="page-head">
        <p className="eyebrow">Friends</p>
        <h1>Bring someone.</h1>
        <p className="lede">
          Send your link to a person who'll actually do a task. You get{" "}
          {formatPoints(referral.referrerBonus)} points when they join; they start with{" "}
          {formatPoints(referral.referredBonus)}.
        </p>
      </header>

      <section className="invite" aria-label="Your referral link">
        <p className="label">Your link</p>
        <div className="invite__paper">
          <code>{referral.link || "The link isn't ready yet."}</code>
          <span className="invite__curl" aria-hidden="true" />
        </div>
        <div className="invite__actions">
          <button type="button" className="btn btn--primary" disabled={!ready} onClick={() => void copy()}>
            <IconCopy size={16} /> Copy link
          </button>
          <button type="button" className="btn btn--ghost" disabled={!ready} onClick={share}>
            <IconShare size={16} /> Share
          </button>
        </div>
        <p className="fine-print">
          Credited once, when they open Taskon with your link. Self-referrals are ignored.
        </p>
      </section>

      <section className="friend-stats" aria-label="Referral totals">
        <div>
          <span className="friend-stats__number">{formatPoints(referral.invited)}</span>
          <span className="friend-stats__label">
            {referral.invited === 1 ? "person joined" : "people joined"}
          </span>
        </div>
        <span className="friend-stats__slash" aria-hidden="true" />
        <div>
          <span className="friend-stats__number">
            <IconCoin size={21} className="friend-stats__coin" />
            {formatPoints(referral.earned)}
          </span>
          <span className="friend-stats__label">points earned from invites</span>
        </div>
      </section>

      <section className="friend-list" aria-label="People you brought in">
        <div className="section-head">
          <h2>Who came in</h2>
          <span className="section-head__count">{referral.recent.length}</span>
        </div>
        {referral.recent.length > 0 ? (
          <ul>
            {referral.recent.map((person, index) => (
              <li key={`${person.username ?? person.firstName}-${person.joinedAt}-${index}`}>
                <span className="friend-list__monogram" aria-hidden="true">
                  {initials(person.firstName ?? person.username)}
                </span>
                <span className="friend-list__who">
                  <strong>{displayName(person)}</strong>
                  <small>
                    joined {relativeDay(person.joinedAt)}
                    {person.username ? ` · @${person.username}` : ""}
                  </small>
                </span>
                <span className="friend-list__paid">+{formatPoints(referral.referrerBonus)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-line">
            Nobody yet. Your link works better in a one-to-one chat than in a group.
          </p>
        )}
      </section>

      <section className="how-pays">
        <div className="section-head">
          <h2>How the bonus works</h2>
          <IconFriends size={18} />
        </div>
        <ol>
          <li>
            <span>01</span>
            <p>They open Telegram and tap your link. Your ID travels with the launch.</p>
          </li>
          <li>
            <span>02</span>
            <p>The server checks the signature, then credits us both once — never per tap.</p>
          </li>
          <li>
            <span>03</span>
            <p>Self-referrals are ignored. Invite bursts and bought accounts get flagged.</p>
          </li>
        </ol>
      </section>

      <aside className="note-block">
        <p>
          Invite people you actually know. Bulk invites and bought accounts get accounts
          flagged, and flagged points can be removed.
        </p>
        <button type="button" className="note-block__link" onClick={share}>
          Share once, not everywhere <IconArrowUpRight size={13} />
        </button>
      </aside>
    </div>
  );
}
