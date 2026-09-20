import { expect, it } from "vitest";
import { createTraps, requireAllowed } from "../src/index.js";
it("works offline without registry or provider",async()=>{const report=await createTraps().inspectText("Today's support incidents are resolved.");expect(report.action).toBe("allow");});
it.each(["block","review","sanitize"])("withholds %s",action=>expect(()=>requireAllowed({action})).toThrow());
it("requires explicit vision configuration",()=>expect(()=>createTraps().inspectImage({image:{bytes:new Uint8Array([1]),mimeType:"image/png"},context:{goal:"Read"}})).toThrow());
