/* ui.lightbox - 简单图片灯箱，用于查看谱面曲绘 */
(function () {
  'use strict';

  function createRoot() {
    let root = document.getElementById('ui-lightbox-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'ui-lightbox-root';
      document.body.appendChild(root);
    }
    return root;
  }

  const root = createRoot();

  function open(src, opts) {
    const overlay = document.createElement('div'); overlay.className = 'lb-overlay';
    const box = document.createElement('div'); box.className = 'lb-box glass-card';
    const img = document.createElement('img'); img.src = src; img.className = 'lb-img';
    const close = document.createElement('button'); close.className = 'lb-close'; close.textContent = '✕';
    close.addEventListener('click', () => { overlay.remove(); });
    box.appendChild(close);
    box.appendChild(img);
    overlay.appendChild(box);
    root.appendChild(overlay);
    // allow click outside to close
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    return {
      close() { overlay.remove(); }
    };
  }

  window.ui = window.ui || {};
  window.ui.lightbox = { open };
})();
