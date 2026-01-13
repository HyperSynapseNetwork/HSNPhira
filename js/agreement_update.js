// Agreement update notifier
(function(){
  const KEY = '__hsn_last_agreement_v';
  async function check(){
    try{
      const r = await fetch('/api/agreements/meta', {cache: 'no-store'});
      if (!r.ok) return;
      const d = await r.json();
      const v = d.version || d.updated_at || '';
      const prev = localStorage.getItem(KEY);
      if (prev && v && prev !== v){
        if (typeof showMessage === 'function'){
          showMessage('服务条款更新', '服务条款已更新，请查看并同意', 'linear-gradient(135deg, rgba(255,192,32,0.08), rgba(255,96,96,0.06))', 0);
        }
      }
      if (v) localStorage.setItem(KEY, v);
    }catch(e){}
  }
  check();
  setInterval(check, 1000*60*30);
})();
