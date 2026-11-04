import {readAborted} from './shared-reads.js';

export const cancellableRead=(operation,args)=>['lms','lexue'].includes(operation)&&['homeworks','materials'].includes(args?.method)||operation==='modern'&&args?.method==='materials';
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{16,80}$/.test(id);
const owner=sender=>JSON.stringify([sender.id,sender.documentId||null,sender.tab?.id??null,sender.frameId??null,sender.documentId?null:sender.url]);

// Cancellation is scoped to the requesting document and applies only to named, read-only scans.
export class ReadRequests{
 constructor(){this.reads=new Map();}
 async run(sender,id,load){
  if(!validId(id))throw new Error('读取标识无效');
  const scope=owner(sender),key=scope+':'+id;if(this.reads.has(key))throw new Error('读取标识重复');
  if([...this.reads.values()].filter(row=>row.scope===scope).length>=128)throw new Error('正在读取的课程过多，请稍后重试');
  const controller=new AbortController();this.reads.set(key,{scope,tabId:sender.tab?.id,controller});
  try{const value=await load(controller.signal);controller.signal.throwIfAborted();return value;}finally{this.reads.delete(key);}
 }
 cancel(sender,id){if(!validId(id))return;this.reads.get(owner(sender)+':'+id)?.controller.abort(readAborted());}
 cancelTab(id){for(const row of this.reads.values())if(row.tabId===id)row.controller.abort(readAborted());}
}
