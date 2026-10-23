import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {normalizeCourse} from '../src/catalog-core.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const input=resolve(process.argv[2]||resolve(root,'local-data/catalog.json'));
const output=resolve(root,'local-data/release-catalog.json');
const date=process.argv[3];
if(!/^\d{4}-\d\d-\d\d$/.test(date||''))throw new Error('Usage: node tools/prepare-release-catalog.mjs INPUT YYYY-MM-DD');
const source=JSON.parse(await readFile(input,'utf8'));
const raw=Array.isArray(source)?source:source.courses;
if(!Array.isArray(raw))throw new Error('Missing course list');
const clean=value=>String(value??'').normalize('NFC').replace(/[\x00-\x1f\x7f\u200b-\u200d\ufeff]/g,' ').replace(/\s+/g,' ').trim();
const mapped=new Map();let invalid=0,duplicates=0,excludedLegacy=0;
for(const item of raw){
 const normalized=normalizeCourse(item);if(!normalized){invalid++;continue;}
 if(normalized.platform!=='modern'){excludedLegacy++;continue;}
 // Public metadata only. Never copy arbitrary source fields or browser records.
 const row={platform:normalized.platform,id:normalized.id,title:clean(normalized.title),teacher:clean(normalized.teacher),term:clean(normalized.term),college:clean(normalized.college),code:clean(normalized.code)};
 if(normalized.tenant!=='21')row.tenant=normalized.tenant;
 if(mapped.has(normalized.key))duplicates++;
 const previous=mapped.get(normalized.key);
 if(previous)for(const field of ['title','teacher','term','college','code'])row[field]||=previous[field];
 mapped.set(normalized.key,row);
}
const courses=[...mapped.values()].sort((a,b)=>a.platform===b.platform?b.term.localeCompare(a.term)||Number(a.id)-Number(b.id):a.platform==='modern'?-1:1);
if(!courses.length)throw new Error('No valid courses');
const counts={total:courses.length,modern:courses.filter(c=>c.platform==='modern').length,legacy:courses.filter(c=>c.platform==='legacy').length};
const header={schema:1,snapshot_date:date,counts};
const bytes=Buffer.from(JSON.stringify(header).slice(0,-1)+',"courses":[\n'+courses.map(c=>JSON.stringify(c)).join(',\n')+'\n]}\n');
if(bytes.length>32*1024*1024)throw new Error('Catalogue exceeds the extension import limit');
await mkdir(dirname(output),{recursive:true});await writeFile(output,bytes);
console.log(JSON.stringify({file:output,...counts,invalid,duplicates,excludedLegacy,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}));
