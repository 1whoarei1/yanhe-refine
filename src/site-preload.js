import {siteRoute} from './site-routes.js';
if(window.top===window&&siteRoute(location.href)){
 document.documentElement?.setAttribute('data-refine-pending','');
 // Fail open if loading the extension's main content script fails.
 setTimeout(()=>document.documentElement?.removeAttribute('data-refine-pending'),8000);
}
