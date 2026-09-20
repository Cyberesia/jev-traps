import { expect, it } from "vitest";
import { triageReportWithJev } from "../src/triage.js";
import fixtures from "./fixtures/triage.json";
const client = (kind: string, relevant: number, sensitive: number, directed: number, quotation: number) => ({ systemOne: async () => ({ model:"mock-jev", answers: { relevantReport:{noul:relevant}, sensitiveContent:{noul:sensitive}, agentDirected:{noul:directed}, benignQuotation:{noul:quotation}, kind:{choice:kind} } }) }) as any;
it("prioritizes an attempt to bypass review without publishing", async()=>{
 const r=await triageReportWithJev(fixtures[0]!.note,{client:client("evidence",.9,.1,.99,.01)});
 expect(r.route).toBe("sensitive_review"); expect(r.requiresHumanReview).toBe(true);
});
it("keeps benign quoted evidence in normal human review",async()=>{
 const r=await triageReportWithJev(fixtures[1]!.note,{client:client("evidence",.99,.01,.9,.99)});
 expect(r.route).toBe("standard_review"); expect(r.requiresHumanReview).toBe(true);
});
it("routes unrelated notes to clarification without deleting them",async()=>expect((await triageReportWithJev(fixtures[2]!.note,{client:client("promotion",.01,.01,.01,.01)})).route).toBe("clarify"));
it("rejects malformed model output and propagates failures",async()=>{
 await expect(triageReportWithJev("report",{client:client("evidence",NaN,0,0,0)})).rejects.toThrow();
 await expect(triageReportWithJev("report",{client:{systemOne:async()=>{throw new Error("offline");}} as any})).rejects.toThrow("offline");
});
