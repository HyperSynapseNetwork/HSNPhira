(function(){
  // Global link handler: open external links (and privacy) inside mac-window component
  function isExternalLink(a) {
    try {
      const href = a.getAttribute('href') || '';
      if (!href) return false;
      // ignore javascript: links
      if (/^\s*javascript:/i.test(href)) return false;
      // treat privacy page specially
      if (/privacy\.html(\b|$)/i.test(href)) return true;
      // protocol-relative or absolute
      if (/^\/\//.test(href)) return true;
      if (/^https?:\/\//i.test(href)) {
        const url = new URL(href, location.href);
        return url.host !== location.host; // external host
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  function ensureMacWindow() {
    let win = document.getElementById('global-mac-window');
    if (!win) {
      win = document.createElement('mac-window');
      win.id = 'global-mac-window';
      // set a sensible default size
      win.style.setProperty('--width','900px');
      win.style.setProperty('--height','640px');
      document.body.appendChild(win);

      // cleanup iframe on close
      win.addEventListener('mac-window-close', () => {
        const iframe = win.querySelector('iframe');
        if (iframe) iframe.src = 'about:blank';
        // remove embedded mode and any custom sizing
        win.removeAttribute('embedded');
        win.style.removeProperty('--width');
        win.style.removeProperty('--height');
        // remove slotted title if any
        const title = win.querySelector('h2[data-window-title]');
        if (title) title.remove();
      });
    }
    return win;
  }

  function openUrlInWindow(url, title, width, height) {
    const win = ensureMacWindow();
    // remove existing iframe to avoid duplicates
    let iframe = win.querySelector('iframe');
    if (iframe) iframe.remove();

    // embedded mode: remove title and let iframe fill the window
    win.setAttribute('embedded','');
    if (width) win.style.setProperty('--width', width);
    if (height) win.style.setProperty('--height', height);

    iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.setAttribute('tabindex','0');
    iframe.setAttribute('loading','lazy');
    iframe.setAttribute('referrerpolicy','no-referrer-when-downgrade');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.minHeight = '320px';
    // make iframe interactive and allow fullscreen/clipboard when possible
    iframe.setAttribute('allow','fullscreen; geolocation; microphone; camera; clipboard-read; clipboard-write');
    // some pages may want to be narrower; allow link to specify data-window-width/height
    win.appendChild(iframe);

    win.open();
    // focus for accessibility
    setTimeout(() => {
      try { iframe.contentWindow && iframe.contentWindow.focus(); } catch(e){}
    }, 300);
  }

  // delegate click handler
  document.addEventListener('click', function(e){
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href) return; // ignore anchors without href

    if (isExternalLink(a)) {
      e.preventDefault();
      const title = a.getAttribute('data-window-title') || a.textContent.trim() || '';
      const width = a.getAttribute('data-window-width');
      const height = a.getAttribute('data-window-height');
      openUrlInWindow(href, title, width, height);
    }
  }, true);

  // Ensure MacWindow is loaded lazily if not present
  if (!window.MacWindow) {
    const s = document.createElement('script');
    s.src = './component/window.js';
    s.onload = () => console.debug('mac-window loaded');
    s.onerror = () => console.warn('failed to load mac-window component');
    document.head.appendChild(s);
  }
})();