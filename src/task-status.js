export function taskStatus(task,now=Date.now()){
 if(task.state==='submitted')return ['已交','submitted'];
 if(task.start>now)return ['未开始','pending'];
 if(task.deadline&&task.deadline<now&&!task.makeUp)return ['已截止','closed'];
 if(task.closed&&!task.makeUp)return [task.deadline>now?'未开放':'已截止','closed'];
 return task.state==='pending'?['未交','pending']:['待同步',''];
}

export function pendingTask(task,now=Date.now()){
 if(!['pending','unknown'].includes(task.state)||task.deadline&&task.deadline<now)return false;
 // is_closed also means not open yet. A future task is still an upcoming obligation.
 return !task.closed||task.makeUp||task.start>now||task.deadline>now;
}
