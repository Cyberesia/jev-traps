import { createHash,timingSafeEqual } from 'node:crypto';
export const authorized=(req,key)=>Boolean(key&&timingSafeEqual(createHash('sha256').update(req.headers.authorization??'').digest(),createHash('sha256').update('Bearer '+key).digest()));
export async function readBody(req,limit=8192){let size=0;const parts=[];for await(const part of req){size+=part.length;if(size>limit)throw new Error('Request too large.');parts.push(part);}return Buffer.concat(parts).toString('utf8');}
export function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
