import { describe, it, expect, vi, afterEach } from "vitest";
import { validateSubmission, readBoundedJson } from "../lib/submissions";
import { POST } from "../app/api/submissions/route";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
afterEach(()=>vi.unstubAllEnvs());
describe("private report queue",()=>{
  it.each(["http://127.0.0.1", "http://[::1]", "http://2130706433", "http://localhost.", "http://a.internal", "https://example.com/?%74oken=x", "https://example.com/#secret", "https://u:p@example.com", "file:///etc/passwd"])("rejects %s",url=>expect(()=>validateSubmission({url})).toThrow());
  it("bounds streaming input",async()=>{await expect(readBoundedJson(new Request("https://example.com",{method:"POST",headers:{"content-type":"application/json"},body:'"'+"x".repeat(9000)+'"'}))).rejects.toThrow("too large");});
  it("acknowledges only persisted reports",async()=>{
    const dir=await mkdtemp(join(tmpdir(),"jev-intake-"));const file=join(dir,"queue.jsonl");
    vi.stubEnv("REGISTRY_DATA_FILE",file);vi.stubEnv("REGISTRY_ENABLE_SUBMISSIONS","1");
    const response=await POST(new Request("https://example.com/api/submissions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:"https://example.com/page",note:"neutral evidence"})}));
    expect(response.status).toBe(202);const saved=JSON.parse(await readFile(file,"utf8"));expect(saved.status).toBe("pending_review");
    vi.stubEnv("REGISTRY_DATA_FILE",join(file,"impossible.jsonl"));
    const failed=await POST(new Request("https://example.com/api/submissions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:"https://example.com/page"})}));expect(failed.status).toBe(503);
  });
  it("is read-only in production by default",async()=>{vi.stubEnv("NODE_ENV","production");vi.stubEnv("REGISTRY_ENABLE_SUBMISSIONS","");expect((await POST(new Request("https://example.com",{method:"POST"}))).status).toBe(503);});
});
