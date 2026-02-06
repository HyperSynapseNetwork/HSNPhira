
/* ui.loader - 简单加载器动画和进度提示管理 */
(function () {
  'use strict';

  function createRoot() {
    let r = document.getElementById('ui-loader-root');
    if (!r) {
      r = document.createElement('div'); r.id = 'ui-loader-root';
      r.className = 'ui-loader-root';
      document.body.appendChild(r);
    }
    return r;
  }

  const tips = [
    '正在加载资源…',
    '正在初始化组件…',
    '正在同步谱面数据…',
    '准备就绪，即将进入…'
  ];

  let intervalId = null;

  function show(initialText) {
    const root = createRoot();
    root.innerHTML = `
      <div class="load_11" aria-hidden="true">
        <div class="rect1"></div>
        <div class="rect2"></div>
        <div class="rect3"></div>
        <div class="rect4"></div>
        <div class="rect5"></div>
      </div>
      <div class="loader-tip">${initialText || tips[0]}</div>
    `;
    root.style.display = 'flex';
    let idx = 0;
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
      idx = (idx + 1) % tips.length;
      const el = document.querySelector('#ui-loader-root .loader-tip');
      if (el) el.textContent = tips[idx];
    }, 2800 + Math.floor(Math.random() * 1200));
  }

  function hide() {
    const root = document.getElementById('ui-loader-root');
    if (root) root.style.display = 'none';
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  }

  window.ui = window.ui || {};
  window.ui.loader = { show, hide };

})();
