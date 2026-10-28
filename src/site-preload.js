import {siteRoute} from './site-routes.js';
import {modeIntent,readSiteMode} from './site-mode.js';
if(window.top===window&&(siteRoute(location.href)||modeIntent(location.href))){
 if(siteRoute(location.href))document.documentElement?.setAttribute('data-refine-pending','');
 void readSiteMode(location.href).then(mode=>{if(mode==='native')document.documentElement?.removeAttribute('data-refine-pending');}).catch(()=>document.documentElement?.removeAttribute('data-refine-pending'));
 // Fail open if loading the extension's main content script fails.
 setTimeout(()=>document.documentElement?.removeAttribute('data-refine-pending'),8000);
}
