import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { IntegrationGuide } from "@/components/integration-guide";
export default function Developers() { return <div className="shell"><SiteNav /><main><header className="dev-header"><div className="eyebrow">SDK / integration guide</div><h1>Your agent. Your tools.<br /><em>An explicit boundary.</em></h1><p className="lead">Intercept retrieved content before the next model call. Inspect it, enforce the result in your host, then continue the task.</p></header><div className="dev-grid"><section className="panel wide"><h2>01 / Connect your agent</h2><IntegrationGuide /></section><section className="panel wide"><h2>02 / Know exactly where data goes</h2><div className="table-wrap"><table className="data-table"><thead><tr><th>Operation</th><th>Data leaving your process</th><th>Recipient</th><th>Registry involved?</th></tr></thead><tbody><tr><td>Static text / HTML scan</td><td>None</td><td>Local code</td><td>No</td></tr><tr><td>Jev semantic scan</td><td>Candidate text, task context, static signals</td><td>TypeSafe / configured Jev model</td><td>No</td></tr><tr><td>Image inspection</td><td>Image bytes + context; then extracted observations</td><td>Your vision provider; then TypeSafe</td><td>No</td></tr><tr><td>Registry lookup</td><td>Public URL queried</td><td>This registry host</td><td>Lookup only; never a scan</td></tr><tr><td>SDK automated observation</td><td>Normalized URL, action, risk, trap types, detector version, surface (non-allow + public URL only; never raw content)</td><td>This registry host /api/observations</td><td>Yes — private, unverified inbox</td></tr><tr><td>Community report</td><td>Public URL + your note</td><td>This host’s private review queue</td><td>No automatic publication</td></tr></tbody></table></div></section><section className="panel" id="vision"><h2>03 / Inspect the whole visual frame</h2><pre className="code">{`import { readFile } from "node:fs/promises";
import { createTraps, createVisionAdapter,
  requireAllowed } from "@jev-traps/sdk";

const traps = createTraps({ vision: {
  adapter: createVisionAdapter({
    provider: "anthropic", // or openai / openweights
    model: process.env.VISION_MODEL!,
    apiKey: process.env.ANTHROPIC_API_KEY,
  }),
}});
const report = await traps.inspectImage({
  image: { bytes: await readFile("screen.png"),
    mimeType: "image/png" },
  context: { source: "slack",
    goal: "Summarize support incidents" },
});
requireAllowed(report);`}</pre><p className="note">Open weights: choose a vision-capable model and explicitly configure your compatible inference server. Jev classification still calls TypeSafe. Original images are withheld on any non-allow result; this SDK does not redact pixels.</p></section><section className="panel"><h2>04 / Enforce all four outcomes</h2><div className="kv"><strong>ALLOW</strong><span>Continue with content treated as untrusted data.</span></div><div className="kv"><strong>SANITIZE</strong><span>Use a verified sanitized representation, or withhold. Never forward the original.</span></div><div className="kv"><strong>REVIEW</strong><span>Pause automatic use. This also covers incomplete image analysis.</span></div><div className="kv"><strong>BLOCK</strong><span>Stop ingestion. Do not execute embedded instructions or requested side effects.</span></div><p className="note">No detector guarantees safety. Model-generated image descriptions and coordinates can be wrong; adversarial visual perturbations remain an open limitation.</p><Link className="text-link" href="/scan">Inspect a public page →</Link></section><section className="panel wide"><h2>Build from source</h2><pre className="code">{`git clone https://github.com/cyberesia/jev-traps.git
cd jev-traps
corepack enable
pnpm install --frozen-lockfile
pnpm test
pnpm dev`}</pre><p className="note">Repository publication is planned at cyberesia/jev-traps. npm packages are prepared for publishing; availability is not assumed. Start with a workspace example or pack locally.</p><a className="text-link" href="https://github.com/cyberesia/jev-traps/blob/main/docs/SDK.md">Full SDK documentation ↗</a></section></div></main></div>; }
