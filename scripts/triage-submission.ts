import { createRequire } from "node:module";
import { triageReportWithJev } from "../packages/jev/src/triage.js";
const require = createRequire(new URL("../apps/registry/package.json", import.meta.url));
const postgres = require("postgres") as typeof import("../apps/registry/node_modules/postgres").default;
const id=process.argv[2];
if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Usage: pnpm triage:submission <pending-submission-uuid>");
if (!process.env.DATABASE_URL || !process.env.TYPESAFE_API_KEY) throw new Error("DATABASE_URL and TYPESAFE_API_KEY are required. Only the selected private note will be sent to TypeSafe.");
const sql=postgres(process.env.DATABASE_URL,{max:1,prepare:false,connect_timeout:5});
try {
 const rows=await sql`select note from submissions where id=${id} and status='pending_review'`;
 if(!rows[0])throw new Error("Pending submission not found");
 const result=await triageReportWithJev(String(rows[0].note));
 // Persist only typed signals/provenance. Keep the submission pending and private.
 const updated=await sql`update submissions set jev_triage=${sql.json(result as any)}, triaged_at=now() where id=${id} and status='pending_review' returning id`;
 if(!updated.length)throw new Error("Submission changed during triage; no result saved");
 console.log(JSON.stringify({id,...result},null,2));
} finally { await sql.end(); }
