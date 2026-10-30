import {LexueReader} from './lexue-reader.js';
import {ReaderBridge} from './reader-bridge.js';
export class LexueClient extends ReaderBridge{
 constructor(options={}){super({kind:'lexue',origin:'https://lexue.bit.edu.cn',fallback:new LexueReader(),...options});}
 courses=force=>this.read({kind:'courses',force}).then(r=>r.rows);
 homeworks=id=>this.read({kind:'homework',id}).then(r=>r.rows);
 materials=id=>this.read({kind:'materials',id}).then(r=>r.rows);
 resources=(courseId,id)=>this.read({kind:'resources',courseId,id}).then(r=>r.rows);
 material=(courseId,id)=>this.read({kind:'material',courseId,id});
 task=(courseId,id)=>this.read({kind:'task',courseId,id});
}
