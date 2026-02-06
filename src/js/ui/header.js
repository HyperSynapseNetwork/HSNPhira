/* header component: minimal header with login state and nav */
(function () {
  'use strict';

  function mountHeader() {
    const header = document.querySelector('.header');
    if (!header) return;
    const nav = document.createElement('div'); nav.className = 'header-nav';
    nav.innerHTML = `
      <div class="brand">HSNPhira</div>
      <div class="nav-links">
        <button class="btn-rect" data-page="home">首页</button>
        <button class="btn-rect" data-page="rooms">房间列表</button>
        <button class="btn-rect" data-page="charts">谱面排行</button>
      </div>
      <div class="header-right">
        <button id="header-login" class="btn-rect">登录</button>
      </div>
    `;
    header.appendChild(nav);

    header.querySelector('#header-login').addEventListener('click', () => {
      window.windowAuth.open();
    });

    // update on auth events
    core.eventBus && core.eventBus.on('auth:login', user => {
      const btn = header.querySelector('#header-login');
      if (user) {
        btn.textContent = user.username || ('#' + user.id);
        btn.addEventListener('click', () => {/* TODO: open user menu */});
      }
    });
  }

  document.addEventListener('DOMContentLoaded', mountHeader);
})();
