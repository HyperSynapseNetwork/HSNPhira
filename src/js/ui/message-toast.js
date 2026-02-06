/*
  ui.message.toast
  - 简单的 toast 实现，队列显示
  - 通过 window.ui.message.toast.show 调用
*/
(function () {
  'use strict';

  const ui = window.ui || (window.ui = {});
  ui.message = ui.message || {};

  function createRoot() {
    let root = document.getElementById('toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      document.body.appendChild(root);
    }
    return root;
  }

  const root = createRoot();

  const Toast = {
    show(text, opts) {
      const el = document.createElement('div');
      el.className = 'ui-toast';
      el.textContent = text;
      root.appendChild(el);
      requestAnimationFrame(() => el.classList.add('in'));
      const duration = (opts && opts.duration) || 3000;
      setTimeout(() => {
        el.classList.remove('in');
        el.addEventListener('transitionend', () => el.remove());
      }, duration);
    }
  };

  ui.message.toast = Toast;
  // 简短别名
  window.ui = ui;
})();
