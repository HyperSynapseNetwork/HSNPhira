/* window-link: 用于在窗口中打开外部页面的简易实现 */
(function () {
  'use strict';

  function openLinkInWindow(url, title) {
    const win = window.windowBase.create({ title: title || url, width: '900px', height: '600px' });
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    win.contentEl.appendChild(iframe);
    win.open();
    return win;
  }

  window.windowLink = { open: openLinkInWindow };
})();
