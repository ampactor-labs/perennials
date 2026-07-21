import { useEffect, useState } from "react";

/**
 * Install, so her notes outlive a week away.
 *
 * Everything she writes is script-writable storage, and a browser reclaims that
 * under pressure: iOS WebKit clears it after about seven days of not visiting a
 * site that is not on the home screen, which is exactly how a seasonal field
 * guide gets used. An installed app is granted persistent storage far more
 * readily and is exempt from that sweep. So this shows only where installing
 * would change the outcome — never once the app is already standalone, and
 * never on a browser with no way to install — and it is phrased for the
 * platform she is on. The backup below is the real insurance; this only lowers
 * how often she would have to reach for it.
 */
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isStandalone = (): boolean =>
  window.matchMedia?.("(display-mode: standalone)").matches === true ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

const isIOS = (): boolean => {
  const ua = navigator.userAgent;
  // iPadOS reports itself as Macintosh; its touch points give it away.
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
};

export function InstallHint() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    const onPrompt = (e: Event) => {
      // Keep the prompt for a button of ours rather than letting the browser
      // fire its own mini-infobar, which the design does not want.
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const ios = isIOS();
  // Nothing to offer: already installed, or a browser that hands us no prompt
  // and has no home-screen gesture to point at. Say nothing rather than nag.
  if (installed || (!ios && !event)) return null;

  const install = async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setEvent(null);
  };

  return (
    <div className="callout" style={{ marginTop: "var(--sp-3)" }}>
      <span>
        <b>Keep this on your home screen.</b>{" "}
        {ios ? (
          <>
            Tap the Share button, then <b>Add to Home Screen</b>. A browser tab clears its stored
            data after about a week away; the installed app keeps your notes, photos and yards
            between visits.
          </>
        ) : (
          <>
            A browser tab can have its stored data cleared under pressure; the installed app keeps
            your notes, photos and yards between visits.{" "}
            <button className="linkish" onClick={() => void install()}>
              Install
            </button>
          </>
        )}{" "}
        Either way, save a copy below — that is the backup that survives anything.
      </span>
    </div>
  );
}
