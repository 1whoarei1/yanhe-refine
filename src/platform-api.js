import {YanheApi} from './watch/api.js';
import {LegacyYanheApi} from './watch/legacy-api.js';
import {parseCourse,replayRows} from './watch/core.js';
import {liveRows} from './watch/live-core.js';
import {normalizeCourse,text} from './catalog-core.js';
import {schoolEpoch} from './lms-core.js';

export class PlatformApi extends YanheApi {
 async authenticate(options={}){if(this.loginFlight)return this.loginFlight;this.loginFlight=super.authenticate(options);try{return await this.loginFlight;}finally{this.loginFlight=null;}}
 async enrolled(){
  await this.authenticate();const rows=[];
  for(let page=1;page<=20;page++){
   const body=await this.json('/vlabpassportapi/v1/account-profile/course',{'force_mycourse':1,'nowpage':page,'per-page':100},{codes:[1000]});
   const data=body.params?.result;if(!data||!Array.isArray(data.data))throw new Error('课程列表格式已变化');
   rows.push(...data.data.map(r=>normalizeCourse(r,'modern')).filter(Boolean));
   if(!data.data.length||rows.length>=Number(data.total))break;
   if(page===20)throw new Error('课程列表过长，请在原站查看');
  }
  return rows;
 }
 async search(q='',page=1,filters={}){
  await this.authenticate();const params={tenant:this.profile.tenant_id,title:q,order:'c.created_at desc',page,per_page:40};
  if(filters.term){const terms=await this.json('/vlabpassportapi/v1/course/term-list',{}, {codes:[1000,0,200]});const t=terms.params?.list?.find(x=>x.term_name===filters.term);if(t)params.term=t.id;else return {rows:[],total:0};}
  if(filters.college){const body=await this.json('/vlabpassportapi/v1/user/structures',{}, {codes:[1000,0,200]});let found;
   const walk=v=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object'){if(v.display_name===filters.college)found=v.id;Object.values(v).filter(x=>x&&typeof x==='object').forEach(walk);}};walk(body.params?.data);
   if(found==null)return {rows:[],total:0};params['struc_ids[]']=found;
  }
  const {data}=await this.json('/courseapi/v3/multi-search/get-course-list',params,{headers:{'tenant-id':String(this.profile.tenant_id)}});
  if(!Array.isArray(data?.list))throw new Error('搜索结果格式已变化');
  return {total:Number(data.total)||0,rows:data.list.map(r=>normalizeCourse(r,'modern')).filter(Boolean)};
 }
 async today(day){
  await this.authenticate();const body=await this.json('/courseapi/v2/course-live/get-my-course-day',{day});const rows=new Map();
  for(const group of Object.values(body.list||{}))for(const raw of group.course||[]){
   const course=normalizeCourse({...raw,id:raw.course_id||raw.id},'modern');if(!course)continue;
   const subId=text(raw.sub_id);if(!/^\d{1,12}$/.test(subId))continue;
   rows.set(`${course.key}:${subId}`,{...course,subId,subTitle:text(raw.sub_title),start:schoolEpoch(raw.course_begin||raw.xstream_begin),end:schoolEpoch(raw.course_over||raw.xstream_end),room:text(raw.room_name),status:text(raw.sub_status)});
  }
  return [...rows.values()].sort((a,b)=>(a.start||0)-(b.start||0));
 }
 async detail(id){
  await this.authenticate();const {data}=await this.json('/courseapi/v3/multi-search/get-course-detail',{course_id:id});
  const course=normalizeCourse(data,'modern');if(!course)throw new Error('未找到课程');
  return {...course,replays:replayRows(data.sub_list),lives:liveRows(data.sub_list)};
 }
 async otherTeacherCourses(id){
  await this.authenticate();const {data}=await this.json('/courseapi/v3/multi-search/get-course-teacher-others',{course_id:id,per_page:20});
  return (Array.isArray(data)?data:[]).map(r=>normalizeCourse(r,'modern')).filter(c=>c&&!c.testCourse);
 }
 async materials(id){
  await this.authenticate();const {data}=await this.json('/courseapi/v3/course-share-resource/get-course-resource',{course_id:id});
  if(!Array.isArray(data))throw new Error('资料格式已变化');
  return data.map((r,i)=>({id:text(r.id||i),title:text(r.name||r.title||r.resource_name)||'课程资料',type:'material',source:'modern',courseId:id,
   url:`https://aita.yanhekt.cn/coursedetail?course_id=${id}&tenant_code=21`}));
 }
}
export class CourseSources {
 constructor(options={}){this.modern=new PlatformApi(options);this.legacy=new LegacyYanheApi(options);}
 async enrolledLegacy(){
  await this.legacy.authenticate();const rows=[];
  for(let page=1;page<=30;page++){
   const {data}=await this.legacy.json('/v2/course/private/list',{page,page_size:100,user_relationship_type:1});
   if(!Array.isArray(data?.data))throw new Error('旧版我的课程格式已变化');
   rows.push(...data.data.map(r=>normalizeCourse({id:r.id,title:r.name_zh,teacher:(r.professors||[]).map(p=>p.name).filter(Boolean).join('、'),term:[r.school_year,r.semester].filter(Boolean).join('-')},'legacy')).filter(Boolean));
   if(!data.data.length||page>=Number(data.last_page)||rows.length>=Number(data.total))return rows;
  }
  throw new Error('旧版课程列表过长');
 }
 async resolve(value,platform){const ref=parseCourse(value,platform);return ref.legacy?this.legacy.resolve(ref):ref;}
 async detail(platform,id){
  if(platform==='modern')return this.modern.detail(id);
  const data=await this.legacy.course(id);return {...normalizeCourse({...data,platform:'legacy'}),replays:data.replays,lives:[]};
 }
 reset(){this.modern.reset();this.legacy.reset();}
}
