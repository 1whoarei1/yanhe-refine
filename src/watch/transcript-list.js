// Variable-height transcript window. Only nearby cues have DOM nodes; the full text stays in player state.
class Heights{
 constructor(size,estimate){this.values=new Float64Array(size).fill(estimate);this.tree=new Float64Array(size+1);for(let i=1;i<=size;i++){this.tree[i]+=estimate;const parent=i+(i&-i);if(parent<=size)this.tree[parent]+=this.tree[i];}}
 sum(end){let total=0;for(let i=end;i>0;i-=i&-i)total+=this.tree[i];return total;}
 set(index,value){const delta=value-this.values[index];if(Math.abs(delta)<.5)return false;this.values[index]=value;for(let i=index+1;i<this.tree.length;i+=i&-i)this.tree[i]+=delta;return true;}
 find(offset){let index=0,total=0,step=1;while(step*2<this.tree.length)step*=2;for(;step;step>>=1){const next=index+step;if(next<this.tree.length&&total+this.tree[next]<=offset){index=next;total+=this.tree[next];}}return Math.min(index,this.values.length-1);}
}

export function mountTranscriptList({list,createRow,estimate=100,overscan=8}){
 const before=document.createElement('div'),content=document.createElement('div'),after=document.createElement('div');
 before.className=after.className='subtitle-spacer';before.setAttribute('aria-hidden','true');after.setAttribute('aria-hidden','true');content.className='subtitle-window';
 let indices=[],positions=new Map(),heights=new Heights(0,estimate),nodes=new Map(),start=0,end=0,frame=0,measureFrame=0,pad=0,width=0,disposed=false,center=null;
 const schedule=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(render);};
 function spacers(){const top=heights.sum(start)+'px',bottom=Math.max(0,heights.sum(indices.length)-heights.sum(end))+'px';if(before.style.height!==top)before.style.height=top;if(after.style.height!==bottom)after.style.height=bottom;}
 function render(){
  cancelAnimationFrame(frame);frame=0;if(disposed||!indices.length)return;
  const view=list.clientHeight;if(!view)return;
  const offset=Math.max(0,list.scrollTop-pad),first=Math.max(0,heights.find(offset)-overscan),last=Math.min(indices.length,heights.find(offset+view)+overscan+1);
  const keep=new Set(indices.slice(first,last));for(const [id,node]of nodes)if(!keep.has(id)){node.remove();nodes.delete(id);}
  let cursor=content.firstElementChild;
  for(let position=first;position<last;position++){
   const id=indices[position];let node=nodes.get(id);if(!node){node=createRow(id);node.dataset.position=String(position);nodes.set(id,node);}
   if(node===cursor)cursor=cursor.nextElementSibling;else content.insertBefore(node,cursor);
  }
  start=first;end=last;spacers();if(!measureFrame)measureFrame=requestAnimationFrame(measure);
 }
 function centerAt(id,smooth=false){
  const position=positions.get(id);if(position===undefined||!list.clientHeight)return;
  const target=Math.max(0,pad+heights.sum(position)+heights.values[position]/2-list.clientHeight/2);
  if(Math.abs(target-list.scrollTop)>2)list.scrollTo({top:target,behavior:smooth&&nodes.has(id)&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'instant'});
  schedule();
 }
 function measure(){
  measureFrame=0;if(disposed||!indices.length||!list.clientHeight)return;
  const offset=Math.max(0,list.scrollTop-pad),anchor=heights.find(offset),inset=list.scrollTop-pad-heights.sum(anchor),atBottom=list.scrollHeight-list.clientHeight-list.scrollTop<2;let changed=false;
  for(const node of nodes.values()){
   const style=getComputedStyle(node),height=node.getBoundingClientRect().height+parseFloat(style.marginTop||0)+parseFloat(style.marginBottom||0);
   if(height>0)changed=heights.set(Number(node.dataset.position),height)||changed;
  }
  if(changed){spacers();if(center!=null)centerAt(center);else if(atBottom&&end===indices.length)list.scrollTop=list.scrollHeight;else{const top=pad+heights.sum(anchor)+inset;if(Math.abs(top-list.scrollTop)>.5)list.scrollTop=top;}schedule();}
 }
 function geometry(){
  if(disposed)return;const style=getComputedStyle(list),nextWidth=list.clientWidth;pad=parseFloat(style.paddingTop)||0;
  if(nextWidth){if(width&&width!==nextWidth)heights=new Heights(indices.length,estimate);width=nextWidth;}schedule();
 }
 function cancelCenter(){center=null;}
 list.addEventListener('scroll',schedule,{passive:true});list.addEventListener('wheel',cancelCenter,{passive:true});list.addEventListener('touchstart',cancelCenter,{passive:true});list.addEventListener('pointerdown',cancelCenter);
 list.addEventListener('keydown',event=>{
  const row=event.target.closest('.subtitle-item'),position=positions.get(Number(row?.dataset.index));
  if(row&&['ArrowUp','ArrowDown','Home','End'].includes(event.key)&&position!==undefined){
   const next=event.key==='Home'?0:event.key==='End'?indices.length-1:Math.max(0,Math.min(indices.length-1,position+(event.key==='ArrowDown'?1:-1)));
   event.preventDefault();cancelCenter();centerAt(indices[next]);render();nodes.get(indices[next])?.focus({preventScroll:true});
  }
 });
 const resize=new ResizeObserver(geometry);resize.observe(list);
 const contentResize=new ResizeObserver(()=>{if(!measureFrame&&!disposed)measureFrame=requestAnimationFrame(measure);});contentResize.observe(content);
 function setRows(rows,{emptyText='暂无字幕'}={}){
  cancelAnimationFrame(frame);cancelAnimationFrame(measureFrame);frame=measureFrame=0;center=null;indices=rows;positions=new Map(rows.map((id,i)=>[id,i]));heights=new Heights(rows.length,estimate);nodes.clear();content.replaceChildren();start=end=0;
  list.replaceChildren(before,content,after);list.scrollTop=0;
  if(!rows.length){const empty=document.createElement('p');empty.className='empty';empty.textContent=emptyText;content.append(empty);before.style.height=after.style.height='0px';return;}
  geometry();render();
 }
 function destroy(){disposed=true;cancelAnimationFrame(frame);cancelAnimationFrame(measureFrame);resize.disconnect();contentResize.disconnect();}
 addEventListener('pagehide',destroy,{once:true});
 return {setRows,scrollToIndex(id,{smooth=true}={}){center=id;centerAt(id,smooth);},cancelCenter,get count(){return indices.length;},destroy};
}
