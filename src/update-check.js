export const RELEASE_REPO='https://github.com/1whoarei1/yanhe-refine';
export const RELEASE_API='https://api.github.com/repos/1whoarei1/yanhe-refine/releases/latest';
const version=value=>typeof value==='string'&&/^v?\d{1,5}(?:\.\d{1,5}){1,3}$/.test(value)?value.replace(/^v/,''):null;
export function compareVersions(a,b){
 const left=version(a),right=version(b);if(!left||!right)throw new Error('版本号无法识别，请打开发布页查看。');
 const x=left.split('.').map(Number),y=right.split('.').map(Number);
 for(let i=0;i<Math.max(x.length,y.length);i++){if((x[i]||0)!==(y[i]||0))return (x[i]||0)>(y[i]||0)?1:-1;}return 0;
}
export function releaseUpdate(data,current){
 const currentVersion=version(current),latestVersion=version(data?.tag_name);
 if(!currentVersion||!latestVersion||data.draft!==false||data.prerelease!==false)throw new Error('发布信息无法识别，请打开发布页查看。');
 const releaseUrl=RELEASE_REPO+'/releases/tag/'+encodeURIComponent(data.tag_name),prefix=RELEASE_REPO+'/releases/download/'+encodeURIComponent(data.tag_name)+'/';
 const assets=(Array.isArray(data.assets)?data.assets:[]).filter(asset=>{
  if(typeof asset?.name!=='string'||typeof asset.browser_download_url!=='string'||asset.state!=='uploaded')return false;
  const stem='yanhe-refine-'+latestVersion;if(asset.name!==stem+'.zip'&&!(asset.name.startsWith(stem+'-')&&/^\d{8}\.zip$/.test(asset.name.slice(stem.length+1))))return false;
  return asset.browser_download_url===prefix+encodeURIComponent(asset.name);
 }).sort((a,b)=>(Date.parse(b.updated_at)||0)-(Date.parse(a.updated_at)||0)||b.name.localeCompare(a.name));
 const compared=compareVersions(latestVersion,currentVersion);
 return {currentVersion,latestVersion,available:compared>0,ahead:compared<0,releaseUrl,downloadUrl:assets[0]?.browser_download_url||null};
}
export async function checkForUpdate(current,{fetcher=globalThis.fetch.bind(globalThis),timeout=10000}={}){
 let response;try{response=await fetcher(RELEASE_API,{credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(timeout)});}
 catch{throw new Error('更新检查连接失败，请稍后重试，或打开发布页查看。');}
 if(response.status===403||response.status===429)throw new Error('更新检查暂时受限，请稍后重试，或打开发布页查看。');
 if(response.status===404)throw new Error('暂未找到正式发布版本，可打开发布页查看。');
 if(!response.ok)throw new Error('更新检查失败，请稍后重试，或打开发布页查看。');
 let data;try{data=await response.json();}catch{throw new Error('发布信息无法识别，请打开发布页查看。');}
 return releaseUpdate(data,current);
}
