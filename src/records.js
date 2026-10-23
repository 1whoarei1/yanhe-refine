export function safeRecords(data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('学习记录格式无效');
 const result={};
 for(const [key,v]of Object.entries(data)){
  if(/^progress:(?:legacy:)?\d{1,12}:[\d:]{1,40}$/.test(key)&&Number.isFinite(v?.time)&&v.time>=0)result[key]={time:v.time,view:['screen','classroom','student'].includes(v.view)?v.view:'screen',updatedAt:Number.isFinite(v.updatedAt)?v.updatedAt:0};
  else if(/^subtitleOffset:(?:legacy:)?\d{1,12}:[\d:]{1,40}:(screen|classroom)$/.test(key)&&Number.isFinite(v?.seconds)&&Math.abs(v.seconds)<=86400)result[key]={seconds:v.seconds};
  else if(key==='lastCourse'&&/^\d{1,12}$/.test(String(v)))result[key]=String(v);
  else if(key==='lastPlatform'&&['legacy','modern'].includes(v))result[key]=v;
  else if(key==='desk:favorites'&&Array.isArray(v))result[key]=[...new Set(v.filter(k=>/^(legacy|modern):\d{1,8}:\d{1,12}$/.test(k)))];
  else if(key==='desk:mappings'&&v&&typeof v==='object')result[key]=Object.fromEntries(Object.entries(v).filter(([k,id])=>/^(legacy|modern):\d{1,8}:\d{1,12}$/.test(k)&&/^\d{1,12}$/.test(String(id))).map(([k,id])=>[k,String(id)]));
 }
 return result;
}
