const PREFIX='replay-cache:',TTL=10*60*1000,LIVE_TTL=20000,MAX_ENTRIES=24;
const memory=new Map();
function snapshot(course){
 const result={};for(const key of ['id','title','teacher','term','college','code','lmsId'])if(course[key]!=null)result[key]=String(course[key]);
 if(course.legacy)result.legacy=true;
 for(const kind of ['replays','lives'])result[kind]=(course[kind]||[]).map(row=>({id:String(row.id),title:String(row.title||''),start:Number(row.start)||0,...(row.mode?{mode:String(row.mode)}:{})}));
 return result;
}
export class ReplayCache{
 constructor(session=globalThis.chrome?.storage?.session,now=Date.now){this.session=session;this.now=now;}
 async key(platform,id,scope){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(scope));return PREFIX+platform+':'+id+':'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
 async read(platform,id,scope,load,{force=false,signal}={}){
  const key=await this.key(platform,id,scope);signal?.throwIfAborted();
  let saved=memory.get(key);if(this.session)try{saved=(await this.session.get(key))[key];}catch{}
  if(!force&&saved?.expires>this.now()&&saved.created<=this.now()){memory.set(key,saved);return structuredClone(saved.course);}
  if(force){memory.delete(key);await this.session?.remove(key).catch(()=>{});}
  const result=await load();signal?.throwIfAborted();const course=snapshot(result);
  const value={course,created:this.now(),expires:this.now()+(course.lives.length?LIVE_TTL:TTL)};
  if(JSON.stringify(value).length<384*1024){
   memory.delete(key);memory.set(key,value);while(memory.size>MAX_ENTRIES)memory.delete(memory.keys().next().value);
   if(this.session)try{
    await this.session.set({[key]:value});const all=await this.session.get(null),entries=Object.entries(all).filter(([key])=>key.startsWith(PREFIX)).sort((a,b)=>(b[1].created||0)-(a[1].created||0));
    const expired=entries.filter(([,v],i)=>i>=MAX_ENTRIES||v.expires<=this.now()).map(([k])=>k);if(expired.length)await this.session.remove(expired);
   }catch{}
  }
  return course;
 }
}
