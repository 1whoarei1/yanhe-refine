import test from 'node:test';
import assert from 'node:assert/strict';
import {LmsReader} from '../src/lms-reader.js';
import {LmsClient} from '../src/lms-client.js';

const courses=[{id:401,name:'当前课',academic_year:{id:81},semester:{id:902}},...Array.from({length:54},(_,i)=>({id:402+i,name:'历史课'+i,academic_year:80,semester:901}))];
const years={academic_years:[{id:81,name:'2026-2027学年'},{id:80,name:'2025-2026学年'}]};
const semesters={semesters:[{id:902,name:'2026-20271季学期',academic_year_id:81},{id:901,name:'2025-20262季学期',academic_year_id:80}]};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});

test('expanded course labels in the screenshot format resolve without extra dictionary requests',async()=>{
 let reads=0;
 const reader=new LmsReader(async url=>{
  assert.equal(new URL(url).pathname,'/api/my-courses');reads++;
  return response({courses:courses.map((course,i)=>({...course,academic_year:{name:i?'2025-2026':'2026-2027'},semester:{name:i?'2025-20262季学期':'2026-20271季学期'}}))});
 });
 const result=await reader.read({kind:'courses'});assert.equal(result.unresolvedTerms,0);assert.equal(result.rows.filter(row=>row.term==='2026-2027-1').length,1);assert.equal(result.rows.filter(row=>row.term==='2025-2026-2').length,54);assert.equal(reads,1);
});

test('55 ID-only courses hydrate with two shared metadata requests; refresh invalidates their cache',async()=>{
 const requests=[];
 const reader=new LmsReader(async(url,options)=>{
  const u=new URL(url);requests.push(u.pathname);assert.equal(options.credentials,'include');assert.equal(options.redirect,'error');assert.ok(!options.method||options.method==='GET');
  if(u.pathname==='/api/my-courses')return response({courses});
  if(u.pathname==='/api/my-academic-years')return response(years);
  if(u.pathname==='/api/my-semesters-all')return response(semesters);
  throw Error('Unexpected API '+u.pathname);
 });
 const first=await reader.read({kind:'courses'});
 assert.equal(first.rows.length,55);assert.equal(first.rows.filter(row=>row.term==='2026-2027-1').length,1);assert.equal(first.unresolvedTerms,0);
 assert.equal(first.rows.filter(row=>row.term==='2025-2026-2').length,54);assert.equal(first.termMetadataVersion,3);assert.equal(requests.length,3);
 await reader.read({kind:'courses'});assert.equal(requests.length,4);
 await reader.read({kind:'courses',force:true});assert.equal(requests.length,7);
});

test('the semester fallback sends real academic-year IDs using the frontend query contract',async()=>{
 const reader=new LmsReader(async url=>{
  const u=new URL(url);
  if(u.pathname==='/api/my-courses')return response({courses});
  if(u.pathname==='/api/my-academic-years')return response({data:years});
  if(u.pathname==='/api/my-semesters-all')return response({},503);
  assert.equal(u.pathname,'/api/my-semesters');assert.deepEqual(u.searchParams.getAll('academic_year_ids').sort(),['80','81']);return response({data:semesters});
 });
 const result=await reader.read({kind:'courses'});assert.equal(result.unresolvedTerms,0);assert.equal(result.rows[0].term,'2026-2027-1');
});

test('unavailable dictionaries preserve courses as unresolved rather than fabricating their semester or login failure',async()=>{
 const reader=new LmsReader(async url=>new URL(url).pathname==='/api/my-courses'?response({courses}):response(null));
 const result=await reader.read({kind:'courses'});assert.equal(result.rows.length,55);assert.equal(result.unresolvedTerms,55);assert.ok(result.rows.every(row=>row.term===''));
});

test('an old reader with blank terms triggers fresh hydration; a new unresolved result is not requested twice',async()=>{
 const client=new LmsClient();let fallbacks=0;
 client.read=async()=>({rows:[{id:'401',term:''}],termMetadataVersion:2});client.fallback.read=async args=>{fallbacks++;assert.equal(args.force,true);return {rows:[{id:'401',term:'2026-2027-1'}]};};
 assert.equal((await client.courses(true))[0].term,'2026-2027-1');assert.equal(fallbacks,1);
 client.read=async()=>({rows:[{id:'401',term:''}],termMetadataVersion:3});
 assert.equal((await client.courses())[0].term,'');assert.equal(fallbacks,1);
});
