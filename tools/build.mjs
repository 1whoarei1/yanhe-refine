import {build} from 'esbuild';
import {mkdir,copyFile,readdir,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),src=join(root,'src'),out=join(root,'extension');
await mkdir(out,{recursive:true});
for(const name of ['desk.html','desk.css','ui-icons.svg','manifest.json','content.css'])await copyFile(join(src,name),join(out,name));
for(const [input,output,format]of [['standalone.js','desk.js','esm'],['background.js','background.js','esm'],['catalog-worker.js','catalog-worker.js','esm'],['content.js','content.js','iife'],['site-preload.js','site-preload.js','iife'],['redirect.js','redirect.js','esm']])
 await build({entryPoints:[join(src,input)],outfile:join(out,output),bundle:true,format,platform:'browser',target:'chrome120',loader:{'.html':'text','.css':'text','.svg':'text'},legalComments:'linked',sourcemap:false,minify:false});
async function copyTree(from,to){await mkdir(to,{recursive:true});for(const entry of await readdir(from,{withFileTypes:true})){const a=join(from,entry.name),b=join(to,entry.name);if(entry.isDirectory())await copyTree(a,b);else await copyFile(a,b);}}
await copyTree(join(src,'watch'),join(out,'watch'));
await writeFile(join(out,'player.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>延河课堂</title><script type="module" src="redirect.js"></script></html>');
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8')),info={version:pkg.version,catalog:null};
try{const data=await readFile(join(root,'local-data/catalog.json'));const count=JSON.parse(data).courses.length;info.catalog={count,sha256:createHash('sha256').update(data).digest('hex')};await writeFile(join(out,'private-catalog.json'),data);}catch(e){if(e.code!=='ENOENT')throw e;}
await writeFile(join(out,'build-info.json'),JSON.stringify(info,null,2));
const table=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(type,data){const t=Buffer.from(type),n=Buffer.alloc(4);n.writeUInt32BE(data.length);let c=0xffffffff;for(const b of Buffer.concat([t,data]))c=table[(c^b)&255]^(c>>>8);const crc=Buffer.alloc(4);crc.writeUInt32BE((c^0xffffffff)>>>0);return Buffer.concat([n,t,data,crc]);}
await mkdir(join(out,'icons'),{recursive:true});
for(const size of [16,32,48,128]){const raw=Buffer.alloc((size*4+1)*size);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size,v=y/size,book=v>.24&&v<.73&&((u>.23&&u<.47)||(u>.53&&u<.77)),line=v>.8&&v<.85&&u>.23&&u<.77;raw.set(book||line?[255,255,255,255]:[40,94,209,255],y*(size*4+1)+1+x*4);}const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;await writeFile(join(out,'icons',`${size}.png`),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}
await mkdir(join(out,'licenses'),{recursive:true});
await copyTree(join(root,'licenses'),join(out,'licenses'));
for(const [from,name]of [['node_modules/fflate/LICENSE','fflate.LICENSE']])await copyFile(join(root,from),join(out,'licenses',name));
for(const packageName of ['saxes','xmlchars']){for(const name of ['LICENSE','LICENSE.txt'])try{await copyFile(join(root,'node_modules',packageName,name),join(out,'licenses',packageName+'.LICENSE'));break;}catch(e){if(e.code!=='ENOENT')throw e;}}
await copyFile(join(root,'LICENSE'),join(out,'LICENSE'));
console.log(JSON.stringify({version:pkg.version,extension:out,localCatalog:info.catalog?.count||0}));
