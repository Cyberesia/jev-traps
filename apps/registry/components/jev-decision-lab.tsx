"use client";
import { useEffect, useState } from "react";
import { recordedCases, recordedAt, questionLabels, replayPolicy } from "@/lib/jev-replay";
const stages = ["Untrusted input", "Jev judgments", "Policy & rating", "Agent decision"];
export function JevDecisionLab() {
  const [selected, setSelected] = useState(0);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const current = recordedCases[selected];
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setStage(value => {
      if (value >= stages.length - 1) { setPlaying(false); return value; }
      return value + 1;
    }), 1800);
    return () => clearInterval(timer);
  }, [playing]);
  return <section className="decision-lab" id="decision-lab" aria-labelledby="decision-title">
    <div className="section-top"><div><div className="eyebrow">Inside the firewall / Powered by Jev</div><h2 id="decision-title">A judgment you can inspect.<br /><span>A decision you can explain.</span></h2></div><p>Follow one piece of content through the actual classifier. Jev answers the semantic questions. TypeScript applies the policy.</p></div>
    {!current ? <div className="panel"><h3>Recorded examples are not available yet.</h3><p className="note">Run the opt-in synthetic evaluation with <code>pnpm record:jev</code>. No invented scores or latency are displayed.</p></div> : <>
      <div className="scenario-tabs" role="group" aria-label="Recorded scenarios">{recordedCases.map((item, i) => <button key={item.id} aria-pressed={i === selected} className={i === selected ? "selected" : ""} onClick={() => { setSelected(i); setStage(0); setPlaying(false); }}><span>0{i + 1}</span>{item.label}</button>)}</div>
      <div className="replay-toolbar"><span><i className="recorded-dot" /> RECORDED REPLAY · SYNTHETIC INPUT</span><button onClick={() => { if (stage === 3) setStage(0); setPlaying(!playing); }} aria-label={playing ? "Pause recorded replay" : "Play recorded replay"}>{playing ? "Pause Ⅱ" : "Play sequence ▷"}</button></div>
      <div className="pipeline-track">{stages.map((name, i) => <button key={name} onClick={() => { setStage(i); setPlaying(false); }} aria-current={stage === i ? "step" : undefined} className={stage === i ? "current" : stage > i ? "complete" : ""}><b>0{i + 1}</b><span>{name}</span><i>{i === 1 ? "JEV" : "HOST"}</i></button>)}</div>
      <div className="decision-grid">
        <div className="input-evidence"><div className="eyebrow">User intent</div><h3>{current.goal}</h3><div className="source-label">Untrusted source · synthetic text</div><blockquote>{current.text}</blockquote><p className="note">The inspected content is evidence. Its instructions never become authority.</p><div className="sample-provenance"><span>Returned model</span><strong>{current.model ?? "Not reported"}</strong><span>Recorded request time</span><strong>{current.durationMs} ms</strong></div></div>
        <div className="judgment-panel"><div className="panel-heading"><span>{stage === 0 ? "NEXT: ONE SEMANTIC REQUEST" : "JEV / STRUCTURED ANSWERS"}</span><span>6 NOUL + 1 CHOICE</span></div><div className="signal-bars">{questionLabels.map(([key, label]) => { const value = current.answers[key]?.noul; return <div className="signal" key={key}><div><span>{label}</span><b>{value === undefined ? "—" : value.toFixed(3)}</b></div><div className="signal-track"><i className={key === "benignQuotation" ? "benign" : ""} style={{ width: `${stage > 0 ? (value ?? 0) * 100 : 0}%` }} /></div></div>; })}</div><div className="role-answer"><span>Content role <small>CHOICE</small></span><strong>{stage > 0 ? current.answers.role?.choice?.replaceAll("_", " ") : "Awaiting replay step"}</strong></div></div>
        <div className={`policy-panel outcome-${current.action}`}><div className="eyebrow">Deterministic enforcement</div><div className="decision-score">{stage >= 2 ? current.risk.toFixed(3) : "—"}<span>risk score</span></div><div className="policy-thresholds"><span>sanitize ≥ {replayPolicy.sanitizeRisk}</span><span>review ≥ {replayPolicy.reviewRisk}</span><span>block ≥ {replayPolicy.blockRisk}</span></div><strong className="final-action">{stage >= 3 ? current.action.toUpperCase() : "PENDING"}</strong><p>{stage >= 3 ? current.action === "allow" ? "Return the content as untrusted data. Keep tool permissions in the host." : "Withhold the original. Resolve the finding before resuming the agent." : "Advance the replay to follow the decision."}</p><a href="/how-it-works#policy">Inspect the policy rules →</a></div>
      </div>
      <details className="trace-details"><summary>Inspect recorded typed response & provenance</summary><pre className="code">{JSON.stringify({recordedAt, model:current.model, durationMs:current.durationMs, answers:current.answers, findings:current.findings, action:current.action, risk:current.risk},null,2)}</pre></details>
      <p className="provenance-note">Recorded on {recordedAt ? new Date(recordedAt).toISOString().slice(0,10) : "an unavailable date"}. Replay animation is not processing time. Each timing is one synthetic end-to-end text inspection, including network latency; no throughput, cost-saving or security-efficacy claim. Risk is a policy score, not a calibrated probability.</p>
    </>}
  </section>;
}
