let available;

// Player pages ask the extension background for small public results; the full catalogs stay there.
// Standalone players whose background does not implement this operation retain their local reader.
export async function sharedCatalog(method,values=[],signal){
 signal?.throwIfAborted();
 if(available===false||typeof document==='undefined'||!globalThis.chrome?.runtime?.sendMessage)return {shared:false};
 let response;
 try{response=await chrome.runtime.sendMessage({type:'REFINE_READ',operation:'publicCatalog',args:{method,values}});}
 catch{signal?.throwIfAborted();available=false;return {shared:false};}
 signal?.throwIfAborted();
 if(!response||!response.ok&&response.error==='不支持的操作'){available=false;return {shared:false};}
 available=true;if(!response.ok)throw new Error(response.error||'课程目录读取失败');
 return {shared:true,value:response.value};
}
