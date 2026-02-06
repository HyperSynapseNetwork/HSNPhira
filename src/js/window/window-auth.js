/* window-auth: 登录 / 注册 弹窗（基于 spec 的登录接口实现，注册为占位提示） */
(function () {
  'use strict';

  function openAuthWindow() {
    const win = window.windowBase.create({ title: '登录 / 注册', width: '420px' });
    const container = document.createElement('div');
    container.className = 'auth-container';

    container.innerHTML = `
      <div class="auth-tabs">
        <button data-mode="login" class="auth-tab active">登录</button>
        <button data-mode="register" class="auth-tab">注册</button>
      </div>
      <div class="auth-body">
        <div class="auth-login">
          <input id="auth-username" placeholder="用户名" />
          <input id="auth-password" placeholder="密码" type="password" />
          <label><input id="auth-remember" type="checkbox" /> 记住我</label>
          <button id="auth-submit" class="btn-rect">提交</button>
        </div>
        <div class="auth-register" style="display:none">
          <input id="reg-username" placeholder="用户名" />
          <input id="reg-password" placeholder="密码" type="password" />
          <input id="reg-phira" placeholder="Phira ID 或用户名" />
          <button id="auth-register-btn" class="btn-rect">注册</button>
          <p class="small">注册流程依赖后端 SSE 验证（按 spec），当前为占位提示。</p>
        </div>
      </div>
    `;

    win.contentEl.appendChild(container);

    const tabButtons = container.querySelectorAll('.auth-tab');
    tabButtons.forEach(b => b.addEventListener('click', () => {
      tabButtons.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const mode = b.getAttribute('data-mode');
      container.querySelector('.auth-login').style.display = mode === 'login' ? '' : 'none';
      container.querySelector('.auth-register').style.display = mode === 'register' ? '' : 'none';
    }));

    // login handler
    container.querySelector('#auth-submit').addEventListener('click', async () => {
      const username = container.querySelector('#auth-username').value;
      const password = container.querySelector('#auth-password').value;
      const remember = !!container.querySelector('#auth-remember').checked;
      try {
        await window.core.auth.login(username, password, remember);
        window.ui && ui.message && ui.message.toast && ui.message.toast.show('登录成功', { duration: 1400 });
        win.close();
      } catch (err) {
        window.ui && ui.message && ui.message.toast && ui.message.toast.show('登录失败', { duration: 2000 });
      }
    });

    // register handler (占位)
    container.querySelector('#auth-register-btn').addEventListener('click', () => {
      window.ui && ui.message && ui.message.toast && ui.message.toast.show('注册流程需后端 SSE 支持，当前为占位', { duration: 3000 });
    });

    win.open();
    return win;
  }

  window.windowAuth = { open: openAuthWindow };
})();
