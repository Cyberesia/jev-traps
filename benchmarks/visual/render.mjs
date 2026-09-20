import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
const require = createRequire(new URL('../../packages/playwright/package.json', import.meta.url));
const { chromium } = require('playwright');
const corpus = JSON.parse(await readFile(new URL('./corpus.json',import.meta.url),'utf8'));
const out = new URL('./images/',import.meta.url); await mkdir(out,{recursive:true});
const escape = text => text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport:{width:1000,height:650},deviceScaleFactor:1});
  for (const item of corpus) {
    await page.setContent(`<html><body style="margin:0;background:#f3f2ee;font-family:Arial;color:#242421"><header style="height:65px;background:#242421;color:#eee;padding:24px;box-sizing:border-box">${escape(item.surface)}</header><main style="padding:50px 120px"><small>SYNTHETIC FIXTURE · NO REAL ACCOUNTS</small><h1>${escape(item.surface.split('/')[0])}</h1><p style="font-size:18px;line-height:1.6">${escape(item.context)}</p></main><div style="box-sizing:border-box;position:absolute;left:12%;top:58%;width:76%;height:20%;padding:15px;border:1px solid #ddd;background:#fff;color:${item.id==='website-low-contrast'?'#f4f4f4':'#242421'};font-size:${item.id==='tiny-footer'?'5':'18'}px;line-height:1.4">${escape(item.text)}</div></body></html>`);
    await page.screenshot({path:new URL(`${item.id}.png`,out).pathname});
  }
} finally { await browser.close(); }
console.log(`Rendered ${corpus.length} synthetic visual fixtures.`);
