"use client";
import { useEffect, useState } from "react";
type AutomatedObservation = { id: string; domain: string; classification: string; status: string; lastVerified: string };
type FeedState = "loading" | "ready" | "unavailable";
const time = new Intl.DateTimeFormat("en-GB", { hour:"2-digit", minute:"2-digit", timeZone:"UTC", hourCycle:"h23" });
export function AutomatedObservations() {
  const [items,setItems] = useState<AutomatedObservation[]>([]);
  const [state,setState] = useState<FeedState>("loading");
  const [paused,setPaused] = useState(false);
  const [checked,setChecked] = useState<string|null>(null);
  const [enabled,setEnabled] = useState(true);
  useEffect(() => {
    if (paused) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      if (document.hidden) { timer=setTimeout(refresh,20000); return; }
      try {
        const response=await fetch("/api/observations",{signal:controller.signal,cache:"no-store"});
        if(!response.ok)throw new Error("unavailable");
        const body=await response.json() as {observations:AutomatedObservation[]; publicFeedEnabled?:boolean};
        if(!Array.isArray(body.observations))throw new Error("invalid feed");
        if(!controller.signal.aborted){setItems(body.observations.slice(0,7));setEnabled(body.publicFeedEnabled!==false);setState("ready");setChecked(new Date().toISOString());}
      } catch { if(!controller.signal.aborted)setState("unavailable"); }
      if(!controller.signal.aborted)timer=setTimeout(refresh,20000);
    };
    void refresh(); return () => { controller.abort(); clearTimeout(timer); };
  },[paused]);
  return <section className="live-observatory" aria-labelledby="activity-title">
    <div className="observatory-heading"><span className="eyebrow">The agent observatory</span><span className={`feed-indicator ${state === "ready" && enabled ? "connected" : ""}`}>{state === "loading" ? "Connecting" : state === "unavailable" ? "Unavailable" : enabled ? "Connected" : "Private intake"}</span></div>
    <h2 id="activity-title">Signals at the boundary.</h2><p className="feed-intro">Validated observations from the reviewed public registry. Raw agent reports remain in the private inbox.</p>
    <div className="feed-column-labels"><span>Source / last verification</span><span>Reviewed classification</span></div>
    {items.length ? <ol className="event-list">{items.map(item => <li key={`${item.id}-${item.lastVerified}`}><div className="event-icon">↳</div><div className="event-source"><strong>{item.domain}</strong><span>{time.format(new Date(item.lastVerified))} UTC</span></div><div className="event-action"><b>{item.classification.replaceAll("_", " ")}</b><span>{item.status}</span></div></li>)}</ol> : <div className="feed-empty"><div className="empty-orbit" aria-hidden="true">j<span>·</span></div><strong>{state === "unavailable" ? "The feed could not be reached." : !enabled ? "Signals stay in the private queue." : "Waiting for the first validated observation."}</strong><p>{!enabled ? "Only reviewed records are public. Automated reporting continues independently." : "No simulated incidents. Reviewed records appear after publication through a pull request. Demo fixtures are excluded."}</p></div>}
    <div className="feed-footer"><span>{checked ? `Checked ${time.format(new Date(checked))} UTC` : "No successful refresh yet"}{state === "unavailable" && items.length ? " · stale results" : ""}</span><button onClick={()=>setPaused(value=>!value)} aria-pressed={paused}>{paused ? "Resume" : "Pause"}</button></div><a className="feed-method" href="/how-it-works#registry">What reaches the registry? ↗</a>
  </section>;
}
