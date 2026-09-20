import { getDatabase } from './db';
export type PageScan = { action:'allow'|'sanitize'|'review'|'block';risk:number;findings:{type:string;detector:string;severity:string;confidence:number;reason:string}[];findingCount:number;mode:'jev'|'static';models:string[];calls:number;inspectionMs:number;fetchMs:number;totalMs:number;bytes:number;redirects:number;coverage:string;detectorVersion:string;scannedAt:string };
export function scanConfiguration() {
 const production=process.env.NODE_ENV==='production';
 let worker=false;
 try { const u=new URL(process.env.SCAN_WORKER_URL??'');worker=!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/scan'&&(u.protocol==='https:'||!production&&u.protocol==='http:'&&u.hostname==='127.0.0.1'); } catch {}
 return {enabled:process.env.REGISTRY_ENABLE_URL_SCAN==='1'&&worker&&Boolean(process.env.SCAN_WORKER_KEY)&&(!production||Boolean(process.env.DATABASE_URL&&process.env.TURNSTILE_SECRET_KEY&&process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)),semantic:process.env.REGISTRY_SCAN_JEV==='1'};
}
let localDay='',localCount=0;
export async function reserveScan() {
 const cap=Math.min(1000,Math.max(1,Number(process.env.REGISTRY_SCAN_DAILY_CAP)||100));
 if(process.env.DATABASE_URL){
  const rows=await getDatabase(process.env.DATABASE_URL)`insert into scan_daily_usage(day, attempts) values(current_date,1) on conflict(day) do update set attempts=scan_daily_usage.attempts+1 where scan_daily_usage.attempts<${cap} returning attempts`;
  return rows.length>0;
 }
 if(process.env.NODE_ENV==='production')throw new Error('Quota store required');
 const today=new Date().toISOString().slice(0,10);if(localDay!==today){localDay=today;localCount=0;}return ++localCount<=cap;
}
export function validScanResult(v:unknown):v is PageScan {
 if(!v||typeof v!=='object')return false;const r=v as PageScan;
 return ['allow','sanitize','review','block'].includes(r.action)&&Number.isFinite(r.risk)&&r.risk>=0&&r.risk<=1&&['jev','static'].includes(r.mode)&&Array.isArray(r.findings)&&r.findings.length<=40&&r.findings.every(f=>f&&typeof f.reason==='string'&&f.reason.length<1000&&typeof f.type==='string'&&typeof f.detector==='string'&&typeof f.severity==='string'&&Number.isFinite(f.confidence)&&f.confidence>=0&&f.confidence<=1)&&Array.isArray(r.models)&&r.models.every(m=>typeof m==='string'&&m.length<120)&&[r.findingCount,r.calls,r.inspectionMs,r.fetchMs,r.totalMs,r.bytes,r.redirects].every(n=>Number.isFinite(n)&&n>=0)&&typeof r.coverage==='string'&&typeof r.detectorVersion==='string'&&typeof r.scannedAt==='string'&&Number.isFinite(Date.parse(r.scannedAt));
}
