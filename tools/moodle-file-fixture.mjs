import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// Chromium service-worker redirect hops can bypass Playwright's request routing.
// Supply final Fetch metadata at this boundary; never send fixture IDs to a real server.
export async function installMoodleFileFixture(extension){
 await writeFile(join(extension,'moodle-file-fixture.js'),`
const networkFetch=globalThis.fetch.bind(globalThis);
globalThis.fixtureResourceReads=[];
globalThis.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url);
 if(url.origin==='https://lexue.bit.edu.cn'&&url.pathname==='/mod/resource/view.php'){
  globalThis.fixtureResourceReads.push({id:url.searchParams.get('id'),range:options.headers?.Range});
  const filename=String.fromCharCode(...new TextEncoder().encode('实验报告模板.doc'));
  const response=new Response('P',{status:206,headers:{'Content-Type':'text/html','Content-Range':'bytes 0-0/23','Content-Disposition':'attachment; filename="'+filename+'"'}});
  Object.defineProperty(response,'url',{value:'https://lexue.bit.edu.cn/pluginfile.php/1901/mod_resource/content/0/slides.pdf?forcedownload=1'});return response;
 }
 return networkFetch(input,options);
};
`);
 const path=join(extension,'background.js');await writeFile(path,"import './moodle-file-fixture.js';\n"+await readFile(path,'utf8'));
}
