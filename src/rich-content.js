const tags=new Set('p br div span strong b em i u s del sub sup blockquote pre code ul ol li h1 h2 h3 h4 h5 h6 table thead tbody tr th td hr a img math mi mn mo mrow msup msub mfrac msqrt mtext'.split(' '));
const blocked=new Set(['script','style','iframe','object','embed','form','input','button','svg','template']);
export function richContent(html,doc=document){
 const parsed=new DOMParser().parseFromString(String(html||''),'text/html'),out=doc.createElement('div');out.className='rich-content';
 const visit=(input,parent)=>{
  if(input.nodeType===3){parent.append(doc.createTextNode(input.textContent));return;}if(input.nodeType!==1)return;
  const tag=input.localName.toLowerCase();if(blocked.has(tag))return;
  const el=tags.has(tag)?doc.createElement(tag):doc.createDocumentFragment();
  if(tag==='a'||tag==='img'){
   const raw=input.getAttribute(tag==='a'?'href':'src');let url;try{url=new URL(raw,'https://zy-eclass.bit.edu.cn');}catch{return;}
   if(url.protocol!=='https:'||url.username||url.password)return;
   if(tag==='img'&&!['zy-eclass.bit.edu.cn','aita.yanhekt.cn','lexue.bit.edu.cn'].includes(url.hostname))return;
   el.setAttribute(tag==='a'?'href':'src',url.href);if(tag==='a'){el.target='_blank';el.rel='noopener noreferrer';}else{el.alt=input.getAttribute('alt')||'';el.loading='lazy';}
  }
  if(['td','th'].includes(tag))for(const attr of ['colspan','rowspan']){const n=Number(input.getAttribute(attr));if(n>0&&n<100)el.setAttribute(attr,String(n));}
  for(const child of input.childNodes)visit(child,el);parent.append(el);
 };
 for(const child of parsed.body.childNodes)visit(child,out);return out;
}
