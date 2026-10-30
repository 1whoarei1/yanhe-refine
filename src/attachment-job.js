export async function attachmentJob({start,status,cancel,wait=()=>new Promise(resolve=>setTimeout(resolve,1000))},signal){
 signal?.throwIfAborted();
 const {id}=await start();let cancellation;
 const stop=()=>{if(!cancellation){cancellation=Promise.resolve().then(()=>cancel(id));cancellation.catch(()=>{});}return cancellation;};
 const onAbort=()=>{void stop();};signal?.addEventListener('abort',onAbort,{once:true});
 try{
  for(;;){
   if(signal?.aborted){await stop();signal.throwIfAborted();}
   const [item]=await status([id]);
   if(signal?.aborted){await stop();signal.throwIfAborted();}
   if(item.state==='complete')return;
   if(item.state==='interrupted')throw new Error('下载未完成');
   await wait();
  }
 }finally{signal?.removeEventListener('abort',onAbort);}
}
