const labels={unknown:['尚未检查','○'],checking:['检查中…',''],connected:['已连接','✓'],login:['需要登录','!'],error:['读取失败','!']};

export function connectionStatus({loading=false,connected,error}={}){
 let state='unknown';
 if(loading)state='checking';
 else if(connected===true)state='connected';
 else if(connected===false){
  // Only explicit login failures count as signed out; network and permission errors do not.
  const message=String(error?.message||'');
  const login=/^(?:请(?:先)?(?:在同一浏览器)?登录|未读到当前浏览器的延河登录状态|(?:旧站)?登录已失效[。！，]|旧乐学登录状态不可用)/.test(message)&&!message.includes('没有访问权限');
  state=login?'login':'error';
 }
 const [label,symbol]=labels[state];return {state,label,symbol};
}
