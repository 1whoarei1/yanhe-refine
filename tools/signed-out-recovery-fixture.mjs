import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// These suites intentionally start signed out. A real tabs.create navigation can
// escape Playwright routing, so fail renewal locally instead of visiting a school.
// The recovery implementation is exercised separately with unit and localhost tests.
export async function installSignedOutRecoveryFixture(extension){
 await writeFile(join(extension,'signed-out-recovery-fixture.js'),`
const createTab=chrome.tabs.create.bind(chrome.tabs);
const renewalOrigins=['https://aita.yanhekt.cn','https://www.yanhekt.cn','https://lexue.bit.edu.cn','https://zy-eclass.bit.edu.cn'];
chrome.tabs.create=async options=>{
 if(options.active===false&&renewalOrigins.some(origin=>(options.url||'').startsWith(origin+'/'))){
  throw Object.assign(new Error('Synthetic signed-out session'),{code:options.url.includes('www.yanhekt.cn')?'SESSION_UNAVAILABLE':'AUTH_REQUIRED'});
 }
 return createTab(options);
};
`);
 const path=join(extension,'background.js');await writeFile(path,"import './signed-out-recovery-fixture.js';\n"+await readFile(path,'utf8'));
}
