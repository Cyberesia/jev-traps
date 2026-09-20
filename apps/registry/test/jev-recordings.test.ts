import { expect, it } from "vitest";
import recordings from "../data/jev-recordings.json";
it("labels recordings as dated synthetic evaluations with actual model provenance",()=>{
 expect(Number.isNaN(Date.parse(recordings.recordedAt))).toBe(false);
 expect(recordings.cases).toHaveLength(3);
 for(const sample of recordings.cases){
  expect(sample.model).toBeTruthy();expect(sample.durationMs).toBeGreaterThan(0);
  expect(sample.risk).toBeGreaterThanOrEqual(0);expect(sample.risk).toBeLessThanOrEqual(1);
  for(const answer of Object.values(sample.answers)){if('noul' in answer){expect(answer.noul).toBeGreaterThanOrEqual(0);expect(answer.noul).toBeLessThanOrEqual(1);}}
 }
 expect(recordings.policy.blockRisk).toBeGreaterThan(recordings.policy.reviewRisk);
 expect(recordings.triage.every(r=>r.requiresHumanReview)).toBe(true);
});
