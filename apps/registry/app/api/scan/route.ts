import { readBoundedJson,validateSubmission } from '../../../lib/submissions';
import { scanConfiguration,reserveScan,validScanResult } from '../../../lib/url-scan';
import { verifyTurnstile } from '../../../lib/turnstile';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){return json(scanConfiguration());}
export async function POST(request:Request){
 const config=scanConfiguration();
 if(!config.enabled)return json({error:'Live page scanning is not available on this deployment yet. You can still report a URL for review.'},503);
 let sameOrigin=false;
 try { const origin=new URL(request.headers.get('origin')??'');const host=request.headers.get('host')??new URL(request.url).host;sameOrigin=origin.host===host&&origin.origin===request.headers.get('origin')&&(origin.protocol==='https:'||process.env.NODE_ENV!=='production'&&origin.protocol==='http:'); } catch {}
 if(!sameOrigin)return json({error:'Open the scan form on this website.'},403);
 let url:string,semantic:boolean,destinationSemantic:boolean;
 try{
  const body=await readBoundedJson(request,8192) as Record<string,unknown>;
  url=validateSubmission({url:body.url}).url;
  if(new URL(url).protocol!=='https:')throw new Error('Use an HTTPS page URL.');
  if(body.website) return json({error:'Request rejected.'},403);
  if(typeof body.semantic!=='boolean')throw new Error('Select an inspection mode.');
  semantic=body.semantic;
  if(body.destinationSemantic!==undefined&&typeof body.destinationSemantic!=='boolean')throw new Error('Select a destination inspection mode.');
  destinationSemantic=Boolean(body.destinationSemantic);
  if(semantic&&!config.semantic)return json({error:'Jev analysis is unavailable on this deployment.'},503);
  if(destinationSemantic&&!config.destinationSemantic)return json({error:'Jev destination assessment is unavailable on this deployment.'},503);
  if(!(await verifyTurnstile(body.turnstileToken,request)).ok)return json({error:'Complete the verification, then try again.'},403);
 }catch{return json({error:'Enter a public HTTPS URL without credentials, query parameters or fragments.'},400);}
 try{
  if(!await reserveScan())return json({error:'The daily scan limit has been reached. Try again tomorrow.'},429);
  const response=await fetch(process.env.SCAN_WORKER_URL!,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.SCAN_WORKER_KEY},body:JSON.stringify({url,semantic,destinationSemantic}),signal:AbortSignal.timeout(57000)});
  if(!response.ok)return json({error:response.status===429?'The scanner is busy. Try again shortly.':'The page could not be inspected. It may block automated access, exceed the size limit, redirect to an unsupported URL, or the analysis service may be unavailable. No verdict was produced.'},response.status===429?429:502);
  const result=await readBoundedJson(new Request('https://worker-result.invalid',{method:'POST',headers:{'content-type':'application/json'},body:response.body,duplex:'half'} as RequestInit),65536);
  if(!validScanResult(result)||result.kind==='content'&&result.mode!==(semantic?'jev':'static'))throw new Error('Invalid scanner result');
  const destination={action:result.destination.action,intelligence:result.destination.intelligence,reason:result.destination.reason,matches:result.destination.matches.map(({source,scope,freshness,reportedAt,status,threat})=>({source,scope,freshness,reportedAt,status,...(threat?{threat}:{})})),...(result.destination.semantic?{semantic:result.destination.semantic}:{})};
  // Explicit fields only: never forward raw HTML, evidence, selectors or worker diagnostics.
  if(result.kind==='destination')return json({kind:'destination',destination,totalMs:result.totalMs,scannedAt:result.scannedAt});
  return json({kind:'content',destination,action:result.action,risk:result.risk,findings:result.findings.map(({type,detector,severity,confidence,reason})=>({type,detector,severity,confidence,reason})),findingCount:result.findingCount,mode:result.mode,models:result.models,calls:result.calls,inspectionMs:result.inspectionMs,fetchMs:result.fetchMs,totalMs:result.totalMs,bytes:result.bytes,redirects:result.redirects,coverage:result.coverage,detectorVersion:result.detectorVersion,scannedAt:result.scannedAt});
 }catch{return json({error:'The scan could not finish. No verdict was produced. Please try again later.'},503);}
}
