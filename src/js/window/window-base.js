/*
  window-base: 基础窗口组件
  - 提供 create / open / close 生命周期钩子
  - 使用 `window.windowBase.create(opts)` 创建并返回实例
*/
(function () {
  'use strict';

  function createContainer() {
    let host = document.getElementById('window-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'window-host';
      document.body.appendChild(host);
    }
    return host;
  }

  function createWindow(opts) {
    const host = createContainer();
    const overlay = document.createElement('div');
    overlay.className = 'window-overlay';
    const box = document.createElement('div');
    box.className = 'window-box glass-card';
    if (opts && opts.width) box.style.width = opts.width;
    if (opts && opts.height) box.style.height = opts.height;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'window-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => instance.close());

    const header = document.createElement('div');
    header.className = 'window-header';
    if (opts && opts.title) header.textContent = opts.title;

    const content = document.createElement('div');
    content.className = 'window-content';

    box.appendChild(closeBtn);
    box.appendChild(header);
    box.appendChild(content);
    overlay.appendChild(box);
    host.appendChild(overlay);

    const instance = {
      el: overlay,
      contentEl: content,
      onOpen: opts && opts.onOpen,
      onClose: opts && opts.onClose,
      open() { overlay.style.display = 'block'; if (this.onOpen) this.onOpen(); return this; },
      close() { overlay.remove(); if (this.onClose) this.onClose(); }
    };

    return instance;
  }

  window.windowBase = { create: createWindow };
})();
