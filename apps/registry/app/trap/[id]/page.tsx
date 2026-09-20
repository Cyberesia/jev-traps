import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { notFound } from "next/navigation";
import { entries, getEntry } from "@/lib/data";

export function generateStaticParams() { return entries.map((entry) => ({ id: entry.id })); }

export default async function TrapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = getEntry(id);
  if (!entry) notFound();
  return <div className="shell">
    <SiteNav />
    <main className="detail">
      <Link className="back" href="/">← Registry</Link>
      <h1>{entry.title ?? entry.url}</h1><p className="note">{entry.url}</p><p className="demo-banner">Synthetic demonstration. Scores, dates and regions are illustrative, not a live verification.</p>
      <div className="detail-grid">
        <section className="panel">
          <h2>Observation</h2>
          <div className="kv"><span>Status</span><strong className={`status ${entry.status}`}>{entry.status}</strong></div>
          <div className="kv"><span>Classification</span><span>{entry.classification.replaceAll("_", " ")}</span></div>
          <div className="kv"><span>Confidence</span><span>{(entry.confidence * 100).toFixed(1)}%</span></div>
          <div className="kv"><span>First seen</span><span>{new Date(entry.firstSeen).toUTCString()}</span></div>
          <div className="kv"><span>Last verified</span><span>{new Date(entry.lastVerified).toUTCString()}</span></div>
          <div className="kv"><span>Observations</span><span>{entry.observations}</span></div>
          <div className="kv"><span>Detector</span><span>{entry.detector}</span></div>
        </section>
        <section className="panel">
          <h2>Trap types</h2>{entry.region && <><p className="note">{entry.source} · {entry.delivery}</p><div className="region-view" aria-label="Illustrative suspicious image region"><span style={{left: `${entry.region.x*100}%`, top: `${entry.region.y*100}%`, width: `${entry.region.width*100}%`, height: `${entry.region.height*100}%`}}>Flagged region</span></div><div className="code">{JSON.stringify(entry.region)}</div></>}
          <div className="tags">{entry.traps.map((trap) => <span className="tag" key={trap}>{trap.replaceAll("_", " ")}</span>)}</div>
        </section>
        <section className="panel" style={{ gridColumn: "1 / -1" }}>
          <h2>Sanitized evidence</h2>
          <div className="code">{entry.evidence}</div>
          <p className="note">Payloads are intentionally rendered inert and may be partially redacted. A confirmed agent trap is not, by itself, proof that the website was hacked.</p>
        </section>
      </div>
    </main>
  </div>;
}
