(() => {
  if (window.top !== window || document.getElementById('yanhe-replay-open')) return;
  const button = document.createElement('button');
  button.id = 'yanhe-replay-open'; button.type = 'button'; button.textContent = '用回放助手打开';
  button.title = '在独立播放器中查看回放、直播与平台字幕';
  button.addEventListener('click', async () => {
    button.disabled=true;
    try {
      const result=await chrome.runtime.sendMessage({type:'OPEN_PLAYER',url:location.href});
      if(!result?.ok)throw new Error();
    } catch { button.textContent='请刷新网页后重试'; }
    finally {button.disabled=false;}
  });
  document.documentElement.append(button);
})();
