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
      // if link points to a downloadable file, do not treat as external page
      const downloadExt = ['.zip', '.osz', '.osu', '.png', '.jpg', '.jpeg', '.gif', '.mp3', '.ogg', '.7z'];
      for (let ext of downloadExt) {
        if (href.toLowerCase().split('?')[0].endsWith(ext)) return false;
      }
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

  // create a new mac-window instance and wire stacking/cleanup
  function createMacWindow() {
    window._macWindowCounter = (window._macWindowCounter || 0) + 1;
    window._macWindowZ = window._macWindowZ || 100001;
    window._macWindowSizeCache = window._macWindowSizeCache || {};
    const id = 'global-mac-window-' + window._macWindowCounter;
    const win = document.createElement('mac-window');
    win.id = id;
    // bring this window to front by assigning z
    win.style.setProperty('--mac-window-z', (window._macWindowZ++).toString());
    // default size
    win.style.setProperty('--width','900px');
    win.style.setProperty('--height','640px');

    // clicking/touching the window brings it to front
    win.addEventListener('pointerdown', () => {
      win.style.setProperty('--mac-window-z', (window._macWindowZ++).toString());
    });

    // cleanup on close: remove element entirely
    const onClose = () => {
      const iframe = win.querySelector('iframe');
      try { if (iframe) iframe.src = 'about:blank'; } catch(e){}
      // remove loader if any
      const loader = win.querySelector('.window-loader');
      try { if (loader && loader.remove) loader.remove(); } catch(e){}
      // finally remove element
      try { win.remove(); } catch(e){}
    };
    win.addEventListener('mac-window-close', onClose);

    document.body.appendChild(win);
    return win;
  }

  function openUrlInWindow(url, title, width, height) {
    const win = createMacWindow();
    // remove existing iframe to avoid duplicates
    let iframe = win.querySelector('iframe');
    if (iframe) iframe.remove();

    // embedded mode: remove title and let iframe fill the window
    win.setAttribute('embedded','');

    // if no explicit width/height provided, check cached size for this URL
    window._macWindowSizeCache = window._macWindowSizeCache || {};
    const key = url;
    if (!width && window._macWindowSizeCache[key]) {
      const s = window._macWindowSizeCache[key];
      if (s.w) win.style.setProperty('--width', s.w + 'px');
      if (s.h) win.style.setProperty('--height', s.h + 'px');
    }
    if (width) win.style.setProperty('--width', width);
    if (height) win.style.setProperty('--height', height);

    // add a loading overlay while iframe loads
    const loader = document.createElement('div');
    loader.className = 'window-loader';
    loader.innerHTML = '<div class="load_11"><div></div><div class="rect2"></div><div class="rect3"></div><div class="rect4"></div><div class="rect5"></div></div>';
    win.appendChild(loader);

    iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.setAttribute('tabindex','0');
    iframe.setAttribute('loading','lazy');
    iframe.setAttribute('referrerpolicy','no-referrer-when-downgrade');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.style.minHeight = '320px';
    iframe.setAttribute('allow','fullscreen; geolocation; microphone; camera; clipboard-read; clipboard-write');

    // remove loader once iframe finishes loading; attempt to cache size when same-origin
    iframe.addEventListener('load', () => {
      try { if (loader && loader.remove) loader.remove(); } catch(e){}
      // try measure content size if same-origin
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (doc) {
          const fullH = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
          const fullW = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth);
          // only cache reasonable sizes
          if (fullH && fullH < 3000) {
            window._macWindowSizeCache[key] = window._macWindowSizeCache[key] || {};
            window._macWindowSizeCache[key].h = fullH;
            window._macWindowSizeCache[key].w = fullW;
            // apply cached height to window for better fit (desktop)
            win.style.setProperty('--height', Math.max(320, fullH) + 'px');
          }
        }
      } catch(e) {
        // cross-origin — ignore
      }
        // try inject minimal reset CSS into same-origin iframe to avoid body margin gaps
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          if (doc) {
            const style = doc.createElement('style');
            style.textContent = 'html,body{height:100%;margin:0;padding:0;background:transparent;}body>*{box-sizing:border-box;}';
            doc.head && doc.head.appendChild(style);
          }
        } catch(e) {
          // cross-origin: cannot inject
        }
        setTimeout(() => { try { iframe.contentWindow && iframe.contentWindow.focus(); } catch(e){} }, 120);
    }, { once: true });

    win.appendChild(iframe);
    // let mac-window manage title/navigation if supported
    try { if (typeof win.registerIframe === 'function') win.registerIframe(iframe, url); } catch(e){}

    win.open();
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