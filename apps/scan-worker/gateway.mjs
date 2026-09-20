import { createServer } from 'node:http';
import { evaluateSnapshot,loadSnapshot,SnapshotProvider } from '@jev-traps/destination';
import { refreshUrlhausSnapshot } from '@jev-traps/destination/urlhaus';
import { DestinationStoppedError,fetchPage,pinnedRequest } from './transport.mjs';
import { authorized,readBody,json } from './http.mjs';
if(!process.env.EGRESS_KEY)throw new Error('EGRESS_KEY required');
const cachePath=process.env.DESTINATION_CACHE_PATH||'/data/urlhaus.json';
const destinationPolicy={
 freshMs:Number(process.env.DESTINATION_FRESH_MS)||30*60_000,
 degradedMs:Number(process.env.DESTINATION_DEGRADED_MS)||6*60*60_000,
 staleMs:Number(process.env.DESTINATION_STALE_MS)||24*60*60_000,
 hostnameReview:process.env.DESTINATION_HOSTNAME_REVIEW!=='0'
};
let destinationProvider;
async function loadDestinationCache(){
 try{destinationProvider=new SnapshotProvider(await loadSnapshot(cachePath),destinationPolicy);}
 catch{destinationProvider=undefined;}
}
async function refreshDestinationCache(){
 if(!process.env.URLHAUS_AUTH_KEY)return;
 try{
  const snapshot=await refreshUrlhausSnapshot({
   authKey:process.env.URLHAUS_AUTH_KEY,cachePath,
   endpoint:process.env.URLHAUS_EXPORT_URL||undefined,
   minRecords:Number(process.env.URLHAUS_MIN_RECORDS)||100
  });
  destinationProvider=new SnapshotProvider(snapshot,destinationPolicy);
 }catch{console.error('Destination intelligence refresh failed; retaining last-known-good snapshot.');}
}
function destinationLookup(url){
 return destinationProvider?.lookup(url)??evaluateSnapshot(url,undefined);
}
await loadDestinationCache();
if(process.env.URLHAUS_AUTH_KEY){
 await refreshDestinationCache();
 const base=Math.max(300_000,Number(process.env.DESTINATION_REFRESH_MS)||600_000);
 const schedule=()=>setTimeout(async()=>{await refreshDestinationCache();schedule();},Math.round(base*(.8+Math.random()*.4))).unref();
 schedule();
}
let active=0;
createServer({requestTimeout:20000,headersTimeout:10000},async(req,res)=>{
 if(req.method==='POST'&&req.url==='/scan'){
  if(!authorized(req,process.env.SCAN_WORKER_KEY))return json(res,401,{error:'Unauthorized'});
  try{const body=await readBody(req);const response=await fetch('http://scanner:9080/scan',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+process.env.SCAN_WORKER_KEY,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(57000)});res.writeHead(response.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(await response.text());}
  catch{json(res,503,{error:'Scanner unavailable'});}
  return;
 }
 if(!authorized(req,process.env.EGRESS_KEY))return json(res,401,{error:'Unauthorized'});
 if(req.method!=='POST'||!['/preflight','/fetch','/v1/systemone'].includes(req.url))return json(res,404,{error:'Not found'});
 if(active>=4)return json(res,429,{error:'Scanner busy'});
 active++;
 try{
  const body=await readBody(req,req.url==='/v1/systemone'?131072:8192);
  if(req.url==='/preflight')return json(res,200,destinationLookup(JSON.parse(body).url));
  if(req.url==='/fetch')return json(res,200,await fetchPage(JSON.parse(body).url,{preflight:destinationLookup}));
  if(!process.env.TYPESAFE_API_KEY)return json(res,503,{error:'Jev unavailable'});
  // A fixed provider path: incoming Authorization and arbitrary URLs are never forwarded.
  const response=await pinnedRequest(new URL('https://api.typesafe.ai/v1/systemone'),{
   method:'POST',body,limit:262144,signal:AbortSignal.timeout(15000),
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.TYPESAFE_API_KEY}});
  res.writeHead(response.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(response.body);
 }catch(error){
  if(error instanceof DestinationStoppedError)return json(res,451,{error:'destination_stopped',preflight:error.preflight});
  json(res,422,{error:'Unable to retrieve this page. It may be private, too large, unsupported, blocked or unavailable.'});
 }
 finally{active--;}
}).listen(9081,'0.0.0.0');
