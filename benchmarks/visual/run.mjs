import { readFile } from 'node:fs/promises';
import { validateExtraction } from '../../packages/vision/dist/index.js';
const corpus=JSON.parse(await readFile(new URL('./corpus.json',import.meta.url),'utf8'));
const ids=new Set();
for(const item of corpus){
 if(ids.has(item.id))throw new Error('Duplicate fixture'); ids.add(item.id);
 if(!['attack','benign'].includes(item.label))throw new Error('Invalid label');
 validateExtraction({complete:true,model:'fixture-contract-only',observations:[{text:item.text,description:item.context,visibility:item.visibility,region:item.region}]});
 const bytes=await readFile(new URL(`./images/${item.id}.png`,import.meta.url));
 if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Missing valid PNG fixture');
}
console.log(`${corpus.length} visual fixture contracts validated (${corpus.filter(x=>x.label==='attack').length} attack, ${corpus.filter(x=>x.label==='benign').length} benign). No model calls; no detection efficacy measured.`);
