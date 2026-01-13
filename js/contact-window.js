// Contact window controller
(function(){
  async function openContact(){
    const tplResp = await fetch('./component/contact.html');
    const text = await tplResp.text();
    const div = document.createElement('div');
    div.innerHTML = text;
    const tpl = div.querySelector('#contact-template');
    if (!tpl) return;

    const win = document.createElement('mac-window');
    win.style.setProperty('--width','640px');
    win.style.setProperty('--height','420px');
    document.body.appendChild(win);

    const content = tpl.content.cloneNode(true);
    const slotWrap = document.createElement('div');
    slotWrap.appendChild(content);
    win.appendChild(slotWrap);

    // simple carousel dummy: try to fetch announcements
    try{
      const r = await fetch('/api/announcements?limit=5');
      if (r.ok){
        const arr = await r.json();
        const carousel = win.querySelector('#contact-carousel');
        if (carousel && Array.isArray(arr)){
          carousel.innerHTML = '';
          arr.forEach(a=>{
            const it = document.createElement('div');
            it.className = 'contact-item';
            it.textContent = a.title || a.summary || '公告';
            carousel.appendChild(it);
          });
        }
      }
    }catch(e){}

    // expose for global usage
    window.openContact = openContact;
  }

  window.openContact = openContact;
})();
