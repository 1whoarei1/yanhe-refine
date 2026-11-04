import {LexueReader} from './lexue-reader.js';
import {ReaderBridge} from './reader-bridge.js';
export class LexueClient extends ReaderBridge{
 constructor(options={}){super({kind:'lexue',origin:'https://lexue.bit.edu.cn',fallback:new LexueReader(),...options});}
 courses=force=>this.read({kind:'courses',force}).then(r=>r.rows);
 homeworks=(id,options)=>this.read({kind:'homework',id},options).then(r=>r.rows);
 materials=(id,options)=>this.read({kind:'materials',id},options).then(r=>r.rows);
 resources=(courseId,id)=>this.read({kind:'resources',courseId,id}).then(r=>r.rows);
 material=(courseId,id)=>this.read({kind:'material',courseId,id});
 task=(courseId,id)=>this.read({kind:'task',courseId,id});
}
