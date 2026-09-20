import { resolve4 } from 'node:dns/promises';
import https from 'node:https';
import { isIP } from 'node:net';
export const MAX_BYTES = 262144;
export class DestinationStoppedError extends Error {
  constructor(preflight){super('Destination retrieval stopped by preflight.');this.preflight=preflight;}
}
export function publicIPv4(ip) {
  if (isIP(ip) !== 4) return false;
  const [a,b,c] = ip.split('.').map(Number);
  return !(a===0 || a===10 || a===127 || a>=224 || (a===100&&b>=64&&b<=127) ||
    (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&(b===168||b===0||b===2||b===88&&c===99)) ||
    (a===198&&(b===18||b===19||b===51&&c===100)) || (a===203&&b===0&&c===113));
}
export function pageURL(raw) {
  if (typeof raw!=='string'||raw.length>2048) throw new Error('Provide a public HTTPS page URL.');
  const u=new URL(raw);
  if (u.protocol!=='https:'||u.port||u.username||u.password||u.search||u.hash||isIP(u.hostname)||
    !u.hostname.includes('.')||/(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion)\.?$/.test(u.hostname))
    throw new Error('Use HTTPS without credentials, query parameters, fragments or custom ports.');
  return u;
}
export async function pinnedRequest(url, {method='GET',body,headers={},limit=MAX_BYTES,signal,resolve=resolve4,request=https.request}={}) {
  const addresses=await resolve(url.hostname);
  if(!addresses.length||addresses.some(ip=>!publicIPv4(ip))) throw new Error('Destination is not a public IPv4 host.');
  if(signal?.aborted) throw new Error('Request timed out.');
  // Connect directly to the validated address. SNI and certificate checks retain the original hostname.
  return new Promise((ok,fail)=>{
    const req=request({hostname:addresses[0],family:4,port:443,servername:url.hostname,
      path:url.pathname+url.search,method,agent:false,rejectUnauthorized:true,signal,
      headers:{Host:url.hostname,'User-Agent':'JevTraps/0.1 (public page inspection)','Accept-Encoding':'identity',...headers}},res=>{
      let size=0;const chunks=[];
      res.on('error',fail);
      res.on('data',chunk=>{size+=chunk.length;if(size>limit){res.destroy(new Error('Page exceeds the 256 KiB inspection limit.'));return;}chunks.push(chunk);});
      res.on('end',()=>ok({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8'),bytes:size}));
    });
    req.on('error',fail);req.setTimeout(10000,()=>req.destroy(new Error('Destination timed out.')));req.end(body);
  });
}
export async function fetchPage(raw,{send=pinnedRequest,signal=AbortSignal.timeout(15000),preflight}={}) {
  let url=pageURL(raw);
  for(let redirects=0;redirects<=3;redirects++) {
    if(preflight){
      const result=await preflight(url.href);
      if(result?.action==='stop')throw new DestinationStoppedError(result);
    }
    const r=await send(url,{signal});
    if([301,302,303,307,308].includes(r.status)) {
      if(!r.headers.location||redirects===3)throw new Error('Too many redirects or missing destination.');
      url=pageURL(new URL(r.headers.location,url).href);continue;
    }
    if(r.status<200||r.status>=300)throw new Error('The website refused the request or is unavailable.');
    const type=String(r.headers['content-type']??'').toLowerCase();
    if(!/^(text\/html|application\/xhtml\+xml|text\/plain)(?:;|$)/.test(type))throw new Error('This scanner accepts web pages and plain text, not images or PDFs.');
    if(r.headers['content-encoding']&&r.headers['content-encoding']!=='identity')throw new Error('The website returned unsupported compressed content.');
    return {url:url.href,html:r.body,bytes:r.bytes,contentType:type,redirects};
  }
}
