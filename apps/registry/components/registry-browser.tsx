"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent } from "react";
import type { RegistryEntry } from "@/lib/types";

const filters = ["all", "active", "removed", "indirect_prompt_injection", "hidden_instruction", "tool_manipulation", "visual_prompt_injection"] as const;

const verifiedAtFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
  hourCycle: "h23",
});

export function RegistryBrowser({ entries }: { entries: RegistryEntry[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const visible = useMemo(() => entries.filter((entry) => {
    const q = query.trim().toLowerCase();
    const queryMatch = !q || (entry.title ?? "").toLowerCase().includes(q) || entry.url.toLowerCase().includes(q) || entry.domain.toLowerCase().includes(q) || entry.traps.some((x) => x.replaceAll("_", " ").includes(q) || x.includes(q));
    const filterMatch = filter === "all" || entry.status === filter || entry.traps.includes(filter);
    return queryMatch && filterMatch;
  }), [entries, query, filter]);

  return <>
    <div className="toolbar">
      <input className="search" value={query} onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} placeholder="Search URL, domain or trap type…" aria-label="Search registry" />
      <div className="pills">{filters.map((item) => <button key={item} className={`pill ${filter === item ? "active" : ""}`} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item.replaceAll("_", " ")}</button>)}</div>
    </div>
    <div className="result-count" aria-live="polite">{visible.length} example{visible.length === 1 ? "" : "s"} · synthetic evidence only</div><div className="grid">
      {visible.map((entry) => <Link className="card" href={`/trap/${entry.id}`} key={entry.id}>
        <div>
          <div className="card-preview" aria-hidden="true"><i /><i /><i /><span>{entry.traps.includes("visual_prompt_injection") ? "▧ localized image evidence" : "⌘ localized content evidence"}</span></div>
          <div className={`status ${entry.status}`}>{entry.status} · {entry.classification.replaceAll("_", " ")}</div>
          <h3>{entry.title ?? entry.url}</h3><p className="card-summary">{entry.evidence}</p>
          <div className="domain">{entry.domain} · {entry.observations} observation{entry.observations === 1 ? "" : "s"} · last verified {verifiedAtFormatter.format(new Date(entry.lastVerified))} UTC</div>
          <div className="tags">{entry.traps.map((trap) => <span className="tag" key={trap}>{trap.replaceAll("_", " ")}</span>)}</div>
        </div>
        <div className="confidence"><span>Demo score</span><strong>{(entry.confidence * 100).toFixed(1)}% ↗</strong></div>
      </Link>)}
      {!visible.length && <div className="panel">No registry entries match this filter.</div>}
    </div>
  </>;
}
