import test from 'node:test';
import assert from 'node:assert/strict';
import {LmsReader} from '../src/lms-reader.js';
import {LmsWriter,validateFile,MAX_UPLOAD_BYTES,storageUploadUrl} from '../src/lms-writer.js';
import {attachmentUrl,homeworkDetail} from '../src/lms-core.js';
import {AttachmentDownloads,safeDownloadUrl,safeFilename} from '../src/downloads.js';

const homework={id:20,course_id:10,type:'homework',published:true,title:'合成作业',is_in_progress:true,non_submit_times:true,data:{homework_type:'file_upload',mode:'normal',description:'<p>题目</p>'},uploads:[{id:30,reference_id:40,name:'fixture.zip',allow_download:true,size:3}]};
const json=body=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
const memory=()=>{const data={};return {get:async key=>({[key]:data[key]}),set:async values=>Object.assign(data,values),remove:async key=>delete data[key]};};
function server(){
 const state={writes:[],history:[],fail:null,historyFail:false,storage:'LOCAL',receipt:'nested',userId:7,detail:structuredClone(homework),session:memory()};
 state.reader=new LmsReader(async(raw,options)=>{
  const path=new URL(raw).pathname;
  if(options.method==='POST'||options.method==='PUT'){
   state.writes.push({path,options});if(new URL(raw).origin==='https://zy-eclass.bit.edu.cn')assert.equal(options.headers['X-XSRF-TOKEN'],'synthetic csrf');
   if(path==='/api/uploads')return json({id:50,upload_url:state.storage==='MEDIA'?'https://zy-media.bit.edu.cn/upload/file/50?signature=synthetic':'/fixture-upload/50',storage_type:state.storage});
   if(path==='/upload/file/50'){assert.equal(new URL(raw).origin,'https://zy-media.bit.edu.cn');assert.equal(new URL(raw).search,'?signature=synthetic');assert.deepEqual(options.headers,{});assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(await options.body.get('file').text(),'abc');return new Response('');}
   if(path==='/fixture-upload/50'){assert.ok(options.body instanceof FormData);assert.equal(await options.body.get('file').text(),'abc');return new Response('');}
   if(path==='/api/course/activities/20/submissions'){
    if(state.fail==='reject')return new Response('',{status:403});
    const payload=JSON.parse(options.body);state.history=[{id:60,comment:payload.comment,is_draft:false,uploads:payload.uploads.map(id=>({id,name:'answer.zip',allow_download:true}))}];
    if(state.fail==='disconnect-unreadable'){state.historyFail=true;throw new TypeError('network unavailable after server accepted');}
    if(state.fail==='disconnect')throw new TypeError('network unavailable after server accepted');
    if(state.receipt==='empty')return new Response(null,{status:204});
    if(state.receipt==='missing')return json({success:true});
    if(state.receipt==='mismatch'){state.history[0].uploads=[];return json({success:true});}
    return json({submission:{id:60}});
   }
   throw new Error('unexpected write');
  }
  if(path==='/api/my-courses')return json({courses:[{id:10,name:'合成课程'}]});
  if(path==='/api/course/10/courseware-activities')return json([state.detail,{id:21,published:false,type:'homework'}]);
  if(path==='/api/activities/20')return json(state.detail);
  if(path==='/api/activities/20/resources')return json({uploads:homework.uploads});
  if(path==='/course/10/content')return new Response(`<span id="userId" data-id="${state.userId}"></span>`);
  if(path===`/api/activities/20/students/${state.userId}/submission_list`)return state.historyFail?new Response('',{status:503}):json({list:state.history});
  if(path==='/api/uploads/50')return json({id:50,status:'ready'});
  throw new Error('unexpected read '+path);
 });
 state.writer=new LmsWriter(state.reader,{cookies:{get:async()=>({value:'synthetic%20csrf'})},session:state.session});return state;
}

test('attachments work from a fresh reader and retain server reference IDs, not tab-local state',async()=>{
 const s=server(),result=await s.reader.read({kind:'resources',courseId:10,id:20});
 assert.equal(result.rows[0].referenceId,'40');assert.equal(attachmentUrl(result.rows[0]),'https://zy-eclass.bit.edu.cn/api/uploads/reference/40/blob');
 assert.equal(attachmentUrl({id:'30',type:'folder',download:true}),'https://zy-eclass.bit.edu.cn/zip/uploads?timezone=-480&upload_ids=30');
 assert.equal(attachmentUrl({id:'50',type:'file',download:true}),'https://zy-eclass.bit.edu.cn/api/uploads/50/blob');
 assert.throws(()=>attachmentUrl({id:'50',type:'file',download:false}));
 assert.throws(()=>attachmentUrl({id:'../50',type:'file',download:true}));
 await assert.rejects(s.reader.read({kind:'resources',courseId:11,id:20}),/所学课程/);
 await assert.rejects(s.reader.read({kind:'resources',courseId:10,id:21}),/已发布/);
 assert.equal(s.writes.length,0);
});
test('unavailable history preserves assignment content but blocks submission until synchronized',async()=>{
 const s=server();s.historyFail=true;const detail=await s.reader.read({kind:'task',courseId:10,id:20});
 assert.equal(detail.description,'<p>题目</p>');assert.equal(detail.attachments.length,1);assert.equal(detail.canSubmit,false);
 await assert.rejects(s.writer.submit(10,20,{requestId:'test-request-0001',comment:'test'}),/记录/);assert.equal(s.writes.length,0);
});
test('closed, exhausted, unsupported, cross-course and unpublished assignments cannot be submitted',()=>{
 for(const changes of [{is_in_progress:false},{is_closed:true},{non_submit_times:false,submit_times:2,user_submit_count:2},{data:{homework_type:'online_quiz'}}])assert.equal(homeworkDetail({...homework,...changes},10).canSubmit,false);
 assert.throws(()=>homeworkDetail({...homework,course_id:11},10));assert.throws(()=>homeworkDetail({...homework,published:false},10));
});
test('upload sends multipart bytes, binds attachment to the student/activity, and submission confirms a real receipt',async()=>{
 const s=server();const file=await s.writer.upload(10,20,{name:'answer.zip',size:3,encoded:'YWJj'});assert.equal(file.id,'50');
 const payload={requestId:'test-request-0001',comment:'answer <tag>',uploads:[file.id]};
 const results=await Promise.all([s.writer.submit(10,20,payload),s.writer.submit(10,20,payload)]);
 assert.deepEqual(results,[{status:'submitted',id:'60'},{status:'submitted',id:'60'}]);
 const posts=s.writes.filter(r=>r.path.endsWith('/submissions'));assert.equal(posts.length,1);
 assert.deepEqual(JSON.parse(posts[0].options.body),{comment:'<p>answer &lt;tag&gt;</p>',uploads:[50],slides:[],is_draft:false,mode:'normal',other_resources:[],uploads_in_rich_text:[]});
 const restarted=new LmsWriter(s.reader,{session:s.session});assert.equal((await restarted.submit(10,20,payload)).status,'submitted');assert.equal(s.writes.length,3);
});
test('ambiguous network failures survive worker restart without repeating the POST',async()=>{
 const s=server();s.fail='disconnect-unreadable';const payload={requestId:'test-request-0002',comment:'answer'};
 assert.equal((await s.writer.submit(10,20,payload)).status,'uncertain');
 const next=new LmsWriter(s.reader,{session:s.session});assert.equal((await next.submit(10,20,payload)).status,'uncertain');assert.equal(s.writes.length,1);
});

test('official MEDIA uploads use their original URL without forwarding LMS credentials or CSRF headers',async()=>{
 const s=server();s.storage='MEDIA';const file=await s.writer.upload(10,20,{name:'answer.zip',size:3,encoded:'YWJj'});
 assert.equal(file.id,'50');assert.equal(s.writes.filter(r=>r.path==='/upload/file/50').length,1);
});

test('storage destinations reject missing URLs, lookalikes, alternate ports, userinfo and wrong media paths',()=>{
 for(const upload_url of [undefined,'','https://zy-media.bit.edu.cn.evil.test/upload/file/50','http://zy-media.bit.edu.cn/upload/file/50','https://zy-media.bit.edu.cn:8443/upload/file/50','https://user:pass@zy-media.bit.edu.cn/upload/file/50','https://zy-media.bit.edu.cn/upload/file/51','https://zy-media.bit.edu.cn/api/other','https://zy-media.bit.edu.cn/upload/file/50#fragment'])assert.throws(()=>storageUploadUrl({id:50,upload_url}));
 assert.equal(storageUploadUrl({id:50,upload_url:'/fixture-upload/50'}).origin,'https://zy-eclass.bit.edu.cn');
});

test('uploaded attachment ownership survives a worker restart and is consumed on confirmed submission',async()=>{
 const s=server();await s.writer.upload(10,20,{name:'answer.zip',size:3,encoded:'YWJj'});
 const restarted=new LmsWriter(s.reader,{session:s.session,cookies:s.writer.cookies});
 assert.equal((await restarted.submit(10,20,{requestId:'test-worker-0001',uploads:['50']})).status,'submitted');
 assert.equal((await s.session.get('desk:upload:50'))['desk:upload:50'],undefined);
});

test('upload ownership cannot be reused after the browser changes accounts',async()=>{
 const s=server();await s.writer.upload(10,20,{name:'answer.zip',size:3,encoded:'YWJj'});s.userId=8;
 const restarted=new LmsWriter(s.reader,{session:s.session,cookies:s.writer.cookies});
 await assert.rejects(restarted.submit(10,20,{requestId:'test-worker-0002',uploads:['50']}),/附件状态/);
 assert.equal(s.writes.filter(r=>r.path.endsWith('/submissions')).length,0);
});

test('missing receipts and lost responses are confirmed only from one new matching server record',async()=>{
 for(const scenario of ['missing','empty','disconnect']){
  const s=server();if(scenario==='disconnect')s.fail=scenario;else s.receipt=scenario;
  const file=await s.writer.upload(10,20,{name:'answer.zip',size:3,encoded:'YWJj'}),payload={requestId:'test-receipt-0001',uploads:[file.id]};
  assert.equal((await s.writer.submit(10,20,payload)).status,'submitted');
  assert.equal((await s.writer.submit(10,20,payload)).status,'submitted');
  assert.equal(s.writes.filter(r=>r.path.endsWith('/submissions')).length,1);
 }
 const s=server();s.receipt='mismatch';const file=await s.writer.upload(10,20,{name:'answer.zip',size:3,encoded:'YWJj'});
 assert.equal((await s.writer.submit(10,20,{requestId:'test-receipt-0002',uploads:[file.id]})).status,'uncertain');
});
test('definite rejection can be explicitly retried, but foreign upload IDs are never accepted',async()=>{
 const s=server();await assert.rejects(s.writer.submit(10,20,{requestId:'test-request-0003',uploads:['999']}),/附件状态/);assert.equal(s.writes.length,0);
 const payload={requestId:'test-request-0003',comment:'answer'};s.fail='reject';await assert.rejects(s.writer.submit(10,20,payload),/403/);s.fail=null;
 assert.equal((await s.writer.submit(10,20,payload)).status,'submitted');assert.equal(s.writes.length,2);
});
test('malformed and oversized files are rejected before any upload request',()=>{
 for(const file of [{name:'../answer.zip',size:3,encoded:'YWJj'},{name:'a.zip',size:MAX_UPLOAD_BYTES+1,encoded:''},{name:'a.zip',size:4,encoded:'YWJj'},{name:'a.zip',size:1,encoded:'!'}])assert.throws(()=>validateFile(file));
});
test('download tracking survives worker sleep and reports interruption; paths cannot escape the download folder',async()=>{
 const session=memory(),calls=[],api={download:async args=>{calls.push(args);return 5;},search:async()=>[{state:'interrupted',error:'NETWORK_FAILED'}]};
 const d=new AttachmentDownloads(api,session);await d.start('https://zy-eclass.bit.edu.cn/api/uploads/reference/40/blob','../name.zip','a/b');
 assert.equal(calls[0].filename,'a_b/.._name.zip');assert.equal(calls[0].saveAs,false);
 assert.equal((await new AttachmentDownloads(api,session).status([5]))[0].state,'interrupted');await assert.rejects(d.status([6]));
 for(const url of ['javascript:alert(1)','https://evil.test/x','https://yanhekt.cn.evil.test/x','https://u:p@aita.yanhekt.cn/x'])assert.throws(()=>safeDownloadUrl(url));
 assert.equal(safeFilename('CON.txt'),'_CON.txt');
});
