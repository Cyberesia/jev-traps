import { createServer } from 'node:http';
import { fetchPage,pinnedRequest } from './transport.mjs';
import { authorized,readBody,json } from './http.mjs';
if(!process.env.EGRESS_KEY)throw new Error('EGRESS_KEY required');
let active=0;
createServer({requestTimeout:20000,headersTimeout:10000},async(req,res)=>{
 if(req.method==='POST'&&req.url==='/scan'){
  if(!authorized(req,process.env.SCAN_WORKER_KEY))return json(res,401,{error:'Unauthorized'});
  try{const body=await readBody(req);const response=await fetch('http://scanner:9080/scan',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+process.env.SCAN_WORKER_KEY,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(57000)});res.writeHead(response.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(await response.text());}
  catch{json(res,503,{error:'Scanner unavailable'});}
  return;
 }
 if(!authorized(req,process.env.EGRESS_KEY))return json(res,401,{error:'Unauthorized'});
 if(req.method!=='POST'||!['/fetch','/v1/systemone'].includes(req.url))return json(res,404,{error:'Not found'});
 if(active>=4)return json(res,429,{error:'Scanner busy'});
 active++;
 try{
  const body=await readBody(req,req.url==='/fetch'?8192:131072);
  if(req.url==='/fetch')return json(res,200,await fetchPage(JSON.parse(body).url));
  if(!process.env.TYPESAFE_API_KEY)return json(res,503,{error:'Jev unavailable'});
  // A fixed provider path: incoming Authorization and arbitrary URLs are never forwarded.
  const response=await pinnedRequest(new URL('https://api.typesafe.ai/v1/systemone'),{
   method:'POST',body,limit:262144,signal:AbortSignal.timeout(15000),
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.TYPESAFE_API_KEY}});
  res.writeHead(response.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(response.body);
 }catch{json(res,422,{error:'Unable to retrieve this page. It may be private, too large, unsupported, blocked or unavailable.'});}
 finally{active--;}
}).listen(9081,'0.0.0.0');
