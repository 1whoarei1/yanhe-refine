export async function readPool(rows,limit,load,{signal,onDone}={}){
 signal?.throwIfAborted();const output=[];let next=0;
 await Promise.all(Array.from({length:Math.min(limit,rows.length)},async()=>{
  while(next<rows.length){
   signal?.throwIfAborted();const index=next++;
   try{const value=await load(rows[index]);signal?.throwIfAborted();output[index]={ok:true,value};}
   catch(error){signal?.throwIfAborted();output[index]={ok:false,error};}
   onDone?.(output.filter(Boolean));
  }
 }));return output;
}
