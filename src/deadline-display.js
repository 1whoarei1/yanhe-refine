export function formatDeadline(value,now=Date.now()){
 if(!Number.isFinite(value))return '无截止时间';
 const year=time=>new Intl.DateTimeFormat('en',{timeZone:'Asia/Shanghai',year:'numeric'}).format(time);
 return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',...(year(value)!==year(now)?{year:'numeric'}:{}),month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(value);
}
