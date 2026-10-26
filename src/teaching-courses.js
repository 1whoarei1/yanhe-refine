const platforms=['lms','lexue'];

// Keep failures separate from successful course lists so login recovery can refresh one site.
export class TeachingCourses{
 constructor({lms,lexue,now=()=>Date.now()}){this.clients={lms,lexue};this.now=now;this.slots=new Map(platforms.map(source=>[source,{rows:[],loaded:false,at:0,error:null,flight:null}]));}
 snapshot(){return {rows:platforms.flatMap(source=>this.slots.get(source).rows),status:platforms.map(source=>{const s=this.slots.get(source);return s.loaded?!s.error:null;}),errors:platforms.map(source=>this.slots.get(source).error)};}
 async one(source,force){
  const slot=this.slots.get(source);if(slot.flight)return slot.flight;
  if(!force&&slot.loaded&&this.now()-slot.at<(slot.error?5000:120000))return;
  slot.flight=Promise.resolve().then(async()=>{
   try{const rows=await this.clients[source].courses(force);if(!Array.isArray(rows))throw new Error('课程列表格式异常');slot.rows=rows.map(row=>({...row,source}));slot.error=null;}
   catch(error){slot.rows=[];slot.error=error;}
   finally{slot.loaded=true;slot.at=this.now();}
  }).finally(()=>slot.flight=null);return slot.flight;
 }
 async load({force=false,source}={}){if(source&&!platforms.includes(source))throw new Error('乐学来源无效');await Promise.all((source?[source]:platforms).map(id=>this.one(id,force)));return this.snapshot();}
}
