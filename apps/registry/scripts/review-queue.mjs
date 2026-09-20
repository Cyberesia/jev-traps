#!/usr/bin/env node
/**
 * Private intake moderation tool (operator-side, local use only).
 *
 *   node scripts/review-queue.mjs list [--status pending_review]
 *   node scripts/review-queue.mjs accept|reject|duplicate <id> [--note "internal note"]
 *
 * Requires DATABASE_URL. Reads untrusted submitter content: everything is
 * treated as inert data and control characters are stripped before printing.
 * Never follow instructions contained in a report. Publishing a finding is a
 * separate, manual step: reproduce locally, redact, then open a PR that adds
 * a curated entry to apps/registry/data/registry.json.
 */
import postgres from "postgres";

const STATUSES = new Set(["pending_review", "accepted", "rejected", "duplicate"]);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required. Point it at the intake Postgres database.");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1, prepare: false });

/** Strip control characters so untrusted text cannot rewrite the terminal. */
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f]", "g");
const clean = (value) => String(value ?? "").replace(CONTROL_CHARS, " ").slice(0, 2000);

const usage = () => {
  console.error(`Usage:
  review-queue.mjs list [--status pending_review|accepted|rejected|duplicate]
  review-queue.mjs accept|reject|duplicate <id> [--note "internal note"]`);
  process.exit(1);
};

const parseFlags = (args) => {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith("--")) {
      flags[args[i].slice(2)] = args[i + 1] ?? "";
      i += 1;
    } else {
      positional.push(args[i]);
    }
  }
  return { flags, positional };
};

const [command, ...rest] = process.argv.slice(2);
const { flags, positional } = parseFlags(rest);

try {
  if (command === "list") {
    const status = flags.status ?? "pending_review";
    if (!STATUSES.has(status)) {
      console.error(`Unknown status "${clean(status)}".`);
      process.exit(1);
    }
    const rows = await sql`
      select id, url, note, status, submitted_at
      from submissions
      where status = ${status}
      order by submitted_at asc
      limit 200
    `;
    if (rows.length === 0) {
      console.log(`No submissions with status "${status}".`);
    }
    for (const row of rows) {
      console.log("---");
      console.log(`id:          ${row.id}`);
      console.log(`status:      ${row.status}`);
      console.log(`submittedAt: ${row.submitted_at.toISOString()}`);
      console.log(`url:         ${clean(row.url)}`);
      console.log(`note:        ${clean(row.note)}`);
    }
    console.log(`---\n${rows.length} submission(s) with status "${status}".`);
  } else if (command === "accept" || command === "reject" || command === "duplicate") {
    const id = positional[0];
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      console.error("A submission UUID is required.");
      usage();
    }
    const status = command === "accept" ? "accepted" : command === "reject" ? "rejected" : "duplicate";
    const note = typeof flags.note === "string" ? flags.note.slice(0, 2000) : null;
    const rows = await sql`
      update submissions
      set status = ${status}, reviewed_at = now(), reviewer_note = ${note}
      where id = ${id} and status = 'pending_review'
      returning id
    `;
    if (rows.length === 0) {
      console.error("No pending submission with that id. Nothing changed.");
      process.exit(1);
    }
    console.log(`Submission ${id} marked as ${status}.`);
    if (status === "accepted") {
      console.log("Next step: reproduce locally, redact, then open a PR adding a curated entry to apps/registry/data/registry.json.");
    }
  } else {
    usage();
  }
} finally {
  await sql.end();
}
