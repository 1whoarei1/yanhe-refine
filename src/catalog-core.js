export const text = value => String(value ?? '').trim();
export const isTrue = value => value === true || value === 1 || value === '1';
export function metadataLabel(value,depth=0){
  if(typeof value==='string')return /\[object\s+[^\]]+\]/i.test(value)?'':value.trim();
  if(typeof value==='number')return Number.isFinite(value)?String(value):'';
  if(!value||typeof value!=='object'||Array.isArray(value)||depth>2)return '';
  for(const key of ['name','label','display_name','title','term_name','value']){const label=metadataLabel(value[key],depth+1);if(label)return label;}
  return '';
}
export function termLabel(value) {
  return metadataLabel(value).replace('学年','').replace(/(\d{4}-\d{4})\s*-?\s*(?:第一学期|第1学期)/,'$1-1').replace(/(\d{4}-\d{4})\s*-?\s*(?:第二学期|第2学期)/,'$1-2');
}

// A year alone or an explicit unknown-semester label is not a useful filter option.
export function hasSpecificTerm(value){
 const match=termLabel(value).normalize('NFKC').replace(/[–—－]/g,'-').match(/^(\d{4})\s*-\s*(\d{4})(.*)$/);
 return Boolean(match&&Number(match[2])===Number(match[1])+1&&match[3].replace(/^[\s-]+/,'').trim()&&!/未(?:标注|标记|注明|指定|填写)|未知|不详|暂无/.test(match[3]));
}
// The modern platform started with the 2021-2022 trial.
export function isModernTerm(value){
 return hasSpecificTerm(value)&&Number(termLabel(value).slice(0,4))>=2021;
}
export function courseTermOptions(rows,platform='all'){
 return [...new Set(rows.filter(row=>platform==='all'||row.platform===platform).flatMap(row=>{const term=termLabel(row.term);return hasSpecificTerm(term)&&(row.platform!=='modern'||isModernTerm(term))?[term]:[];}))].sort().reverse();
}

export function teachers(value) { return [...new Set(text(value).split(/[、，,;；]/).map(x=>x.trim()).filter(Boolean))]; }
export function courseKey(platform,id,tenant='21') { return `${platform}:${tenant}:${id}`; }
export function normalizeCourse(row,source) {
  if (!row || typeof row!=='object') return null;
  const rawUrl=text(row.url||row['课程链接']);
  let platform=source||row.platform,linkedId;
  if(rawUrl){try{const u=new URL(rawUrl);if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
    if(u.hostname==='www.yanhekt.cn'){const match=u.pathname.match(/^\/course\/(\d{1,12})\/?$/);if(!match)return null;platform='legacy';linkedId=match[1];}
    else if(u.hostname==='aita.yanhekt.cn'){platform='modern';linkedId=u.searchParams.get('course_id')||undefined;}else return null;}catch{return null;}}
  platform=platform||('课程ID' in row?'legacy':'modern');
  if(!['legacy','modern'].includes(platform))return null;
  const id=text(row.id??row.Id??row.course_id??row['课程ID']??linkedId);
  const title=text(row.title??row.Title??row.course_title??row['课程名称']);
  if(!/^\d{1,12}$/.test(id)||!title||(linkedId&&linkedId!==id))return null;
  const teacher=text(row.teacher??row.Teacher??row.realname??row['授课教师']);
  const term=termLabel(row.term_name??row.term??row.TermName??row['学年学期']);
  const tenant=/^\d{1,8}$/.test(text(row.tenant))?text(row.tenant):'21';
  const college=text(row.college??row.kkxy_name??row['开课学院']);
  const code=text(row.code??row.course_code??row['课程代码']);
  const result={key:courseKey(platform,id,tenant),platform,tenant,id,title,teacher,teachers:teachers(teacher),term,college:college==='未标注'?'':college,code,
    url:platform==='legacy'?`https://www.yanhekt.cn/course/${id}`:`https://aita.yanhekt.cn/coursedetail?course_id=${id}&tenant_code=${tenant}`};
  if(row.indexSource==='autoslides'&&platform==='legacy'){result.indexSource='autoslides';if(Number.isSafeInteger(row.indexSessionCount)&&row.indexSessionCount>=0)result.indexSessionCount=row.indexSessionCount;}
  const lmsId=text(row.lmsId??row.zhiyuan_id);
  if(/^\d{1,12}$/.test(lmsId)&&lmsId!=='0')result.lmsId=lmsId;
  if(row.replayCount!=null&&Number.isFinite(Number(row.replayCount)))result.replayCount=Number(row.replayCount);
  result.testCourse=/测试|试用|^cs$/i.test(title)||teacher==='超级管理员';
  result.search=[title,teacher,id,result.college,code].join(' ').normalize('NFKC').toLowerCase();
  return result;
}
export function matchesCourse(course,options={}) {
  if(options.platform&&options.platform!=='all'&&course.platform!==options.platform)return false;
  if(options.term&&course.term!==options.term)return false;
  if(options.college&&course.college!==options.college)return false;
  if(options.teacher&&!course.teachers.some(t=>t===options.teacher))return false;
  if(!options.includeTests&&course.testCourse)return false;
  const words=text(options.q).normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean);
  return words.every(word=>course.search.includes(word));
}
const collator=new Intl.Collator('zh-CN');
export function searchCourses(rows,options={}) {
  const filtered=rows.filter(row=>matchesCourse(row,options));
  filtered.sort((a,b)=>b.term.localeCompare(a.term)||collator.compare(a.title,b.title)||Number(b.id)-Number(a.id));
  const offset=Math.max(0,Number(options.offset)||0),limit=Math.min(100,Math.max(1,Number(options.limit)||40));
  return {total:filtered.length,rows:filtered.slice(offset,offset+limit)};
}
export function relatedCourses(rows,course,kind='teacher',limit=12) {
  return rows.filter(c=>c.key!==course.key&&!c.testCourse&&(kind==='teacher'?c.teachers.some(t=>course.teachers.includes(t)):
    (course.code&&c.code?course.code===c.code:c.title===course.title))).sort((a,b)=>b.term.localeCompare(a.term)||Number(b.id)-Number(a.id)).slice(0,limit);
}
