import { createServer } from 'node:http';
import { fork } from 'node:child_process';
import { authorized,readBody,json } from './http.mjs';
import { pageURL } from './transport.mjs';
if(!process.env.SCAN_WORKER_KEY||!process.env.EGRESS_KEY||!process.env.EGRESS_URL)throw new Error('Worker credentials and egress URL required');
let active=0;
createServer({requestTimeout:10000,headersTimeout:5000},async(req,res)=>{
 if(!authorized(req,process.env.SCAN_WORKER_KEY))return json(res,401,{error:'Unauthorized'});
 if(req.method!=='POST'||req.url!=='/scan')return json(res,404,{error:'Not found'});
 if(active>=2)return json(res,429,{error:'Scanner is busy. Try again shortly.'});
 let input;try{input=JSON.parse(await readBody(req));pageURL(input.url);if(typeof input.semantic!=='boolean')throw new Error();}catch{return json(res,400,{error:'Provide a public HTTPS URL without query parameters or fragments.'});}
 if(input.semantic&&process.env.ENABLE_JEV!=='1')return json(res,503,{error:'Jev analysis is not configured.'});
 active++;
 const child=fork(new URL('./inspect.mjs',import.meta.url),[],{execArgv:['--max-old-space-size=192'],stdio:['ignore','ignore','ignore','ipc'],env:{PATH:process.env.PATH,SCAN_CHILD:'1',EGRESS_URL:process.env.EGRESS_URL,EGRESS_KEY:process.env.EGRESS_KEY}});
 let finished=false;
 const finish=(status,body)=>{if(finished)return;finished=true;clearTimeout(timer);active--;child.kill('SIGKILL');if(!res.destroyed)json(res,status,body);};
 const timer=setTimeout(()=>finish(504,{error:'Scan timed out. No verdict was produced.'}),55000);
 child.once('message',message=>finish(message.ok?200:422,message.ok?message.result:{error:'Unable to complete this scan. The page may be blocked, too large or unsupported, or the model unavailable. No verdict was produced.'}));
 child.once('error',()=>finish(502,{error:'Scanner unavailable.'}));child.once('exit',()=>finish(502,{error:'Scan could not finish.'}));
 res.once('close',()=>finish(499,{}));child.send(input);
}).listen(9080,'0.0.0.0');
