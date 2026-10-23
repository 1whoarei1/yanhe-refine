import layout from './desk.html';
import styles from './desk.css';
import icons from './ui-icons.svg';
import {startDesk} from './desk.js';
import {siteRoute,siteHref,nativeHref} from './site-routes.js';

export function mountSite(){
 document.open();document.write('<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>');document.close();
 const html=document.documentElement,body=document.body||html.appendChild(document.createElement('body'));html.dataset.refine='active';body.style.margin='0';document.title='延河课堂';
 const host=document.createElement('div');host.id='yanhe-refine';body.append(host);const shadow=host.attachShadow({mode:'open'});
 const sheet=new CSSStyleSheet();sheet.replaceSync(styles.replace(':root',':host').replace('body{margin:0}', '.refine-root{margin:0}'));shadow.adoptedStyleSheets=[sheet];
 const template=new DOMParser().parseFromString(layout,'text/html');template.querySelectorAll('script').forEach(n=>n.remove());
 const wrapper=document.createElement('div');wrapper.className='refine-root';wrapper.append(...Array.from(template.body.childNodes));shadow.append(wrapper);
 const symbols=new DOMParser().parseFromString(icons,'image/svg+xml');
 shadow.querySelectorAll('use').forEach(use=>{const symbol=symbols.getElementById(use.getAttribute('href').split('#').at(-1));if(symbol){const svg=use.parentNode;svg.setAttribute('viewBox',symbol.getAttribute('viewBox')||'0 0 24 24');svg.replaceChildren(...Array.from(symbol.childNodes).map(n=>n.cloneNode(true)));}});
 shadow.querySelectorAll('a[href^="#/"]').forEach(a=>a.href=siteHref(a.getAttribute('href')));
 shadow.querySelector('.brand span').textContent='延河课堂';
 const account=shadow.querySelector('#account-link');account.href=nativeHref('https://aita.yanhekt.cn/portal/#/');account.removeAttribute('target');
 const original=shadow.querySelector('.original-link');original.textContent='恢复原版';original.href=nativeHref(location.href);original.removeAttribute('target');
 let app;
 const navigate=(route,replace=false)=>{const target=new URL(siteHref(route));if(target.origin!==location.origin){location.assign(target.href);return;}history[replace?'replaceState':'pushState']({},'',target.href);original.href=nativeHref(location.href);void app.render();};
 shadow.addEventListener('click',e=>{if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;const a=e.composedPath().find(n=>n?.tagName==='A');if(!a||a.target==='_blank'||a.download)return;const url=new URL(a.href,location.href),route=siteRoute(url.href);if(!route)return;e.preventDefault();if(url.origin!==location.origin){location.assign(url.href);return;}history.pushState({},'',url.href);original.href=nativeHref(location.href);void app.render();});
 app=startDesk({root:shadow,currentRoute:()=>siteRoute(location.href)||'/today',navigate,hrefForRoute:siteHref,site:true});
 const restoreLocation=()=>{original.href=nativeHref(location.href);if(siteRoute(location.href))void app.render();else location.reload();};
 addEventListener('popstate',restoreLocation);
 addEventListener('hashchange',restoreLocation);
 chrome.runtime.onMessage.addListener(message=>{if(message.type==='REFINE_RESTORE')location.assign(nativeHref(location.href));});
 return app;
}
