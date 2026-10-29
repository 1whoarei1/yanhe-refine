// Match Moodle's Beijing-time academic-year convention. A future course in the
// catalogue must not move the default task filter to a future semester.
export function currentTeachingTerm(now=Date.now()){
 const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Shanghai',year:'numeric',month:'numeric'}).formatToParts(now);
 const year=Number(parts.find(p=>p.type==='year').value),month=Number(parts.find(p=>p.type==='month').value);
 const start=month>=9?year:year-1;
 return `${start}-${start+1}-${month>=2&&month<9?'2':'1'}`;
}
