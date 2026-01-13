// Simple auto-update checker
(function(){
  const CHECK_INTERVAL = 1000 * 60 * 5; // 5 minutes
  async function check(){
    try{
      const r = await fetch('/api/version', {cache: 'no-store'});
      if (!r.ok) return;
      const data = await r.json();
      if (!window.__hsn_last_version) window.__hsn_last_version = data.version;
      if (data.version && data.version !== window.__hsn_last_version){
        window.__hsn_last_version = data.version;
        if (typeof showMessage === 'function'){
          showMessage('更新可用', '检测到新版本，建议刷新页面以获取最新内容', 'linear-gradient(135deg, rgba(32,160,255,0.12), rgba(0,200,120,0.08))', 0);
        }
      }
    }catch(e){
      // ignore
    }
  }
  check();
  setInterval(check, CHECK_INTERVAL);
})();
