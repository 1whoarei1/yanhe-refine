const from=new URLSearchParams(location.search),to=new URL(chrome.runtime.getURL('watch/player.html'));
for(const key of ['course','legacy','legacy_live','legacy_session','sub_id'])if(/^\d{1,12}$/.test(from.get(key)||''))to.searchParams.set(key,from.get(key));
location.replace(to.href);
