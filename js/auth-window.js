(function(){
  // Centralized auth window using mac-window
  const state = { authMode: 'login', win: null };

  function createWindowIfNeeded(){
    if (state.win && document.body.contains(state.win)) return state.win;
    // create a mac-window instance
    const win = document.createElement('mac-window');
    win.id = 'auth-mac-window';
    // smaller default
    win.style.setProperty('--width','420px');
    win.style.setProperty('--height','380px');
    document.body.appendChild(win);
    state.win = win;

    // when closed remove instance so next open creates fresh one
    win.addEventListener('mac-window-close', () => {
      try { win.remove(); } catch(e){}
      state.win = null;
    });

    return win;
  }

  function openAuth(){
    const tmpl = document.getElementById('auth-template');
    if (!tmpl) return console.warn('auth template missing');
    const win = createWindowIfNeeded();

    // clear previous content
    const existing = win.querySelector('#auth-box');
    if (existing) existing.remove();

    const node = tmpl.content.cloneNode(true);
    // append nodes into window (slot area)
    win.appendChild(node);

    // wire up buttons
    const submitBtn = win.querySelector('#auth-submit');
    const toggleBtn = win.querySelector('#auth-toggle');
    const msgElem = win.querySelector('#auth-msg');

    if (submitBtn) submitBtn.addEventListener('click', submitAuth);
    if (toggleBtn) toggleBtn.addEventListener('click', toggleAuthMode);

    // ensure UI initial state
    updateAuthUI();

    win.open();
  }

  function closeAuth(){
    if (state.win) state.win.close();
  }

  function toggleAuthMode(){
    state.authMode = state.authMode === 'login' ? 'register' : 'login';
    updateAuthUI();
  }

  function updateAuthUI(){
    const win = state.win || document.getElementById('auth-mac-window');
    const title = win && win.querySelector('#auth-title');
    const phiraid = win && win.querySelector('#auth-phiraid');
    const agreementContainer = win && win.querySelector('#agreement-container');
    if (!title) return;
    if (state.authMode === 'login'){
      title.textContent = '用户登录';
      if (phiraid) phiraid.classList.add('collapsed');
      if (agreementContainer) agreementContainer.style.display = 'none';
    } else {
      title.textContent = '用户注册';
      if (phiraid) phiraid.classList.remove('collapsed');
      if (agreementContainer) agreementContainer.style.display = 'flex';
    }
  }

  async function submitAuth(){
    const win = state.win || document.getElementById('auth-mac-window');
    if (!win) return;
    const username = win.querySelector('#auth-name').value;
    const password = win.querySelector('#auth-password').value;
    const phira_id = win.querySelector('#auth-phiraid').value;
    const remember = !!(win.querySelector('#remember-me') && win.querySelector('#remember-me').checked);
    const agreeTerms = state.authMode === 'register' ? !!(win.querySelector('#agree-terms') && win.querySelector('#agree-terms').checked) : true;
    const msg = win.querySelector('#auth-msg');
    if (msg) msg.textContent = '处理中...';

    try {
      if (state.authMode === 'register' && !agreeTerms) {
        if (msg) msg.textContent = '请同意用户协议';
        return;
      }
      const endpoint = state.authMode === 'login' ? '/api/auth/login' : '/api/auth/users';
      const payload = state.authMode === 'login' ? { username, password, remember } : { username, password, phira_id };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        if (msg) msg.textContent = err.message || '操作失败';
        return;
      }
      if (state.authMode === 'login'){
        // refresh global currentUser if applicable
        try {
          const userRes = await fetch('/api/auth/me');
          if (userRes.ok) {
            window.currentUser = await userRes.json();
            if (window.updateUserDisplay) try { window.updateUserDisplay(); } catch(e){}
          }
        } catch(e){}
      }
      if (msg) msg.textContent = state.authMode === 'login' ? '登录成功！' : '注册成功！';
      setTimeout(()=>{
        try { closeAuth(); } catch(e){}
        if (state.authMode === 'register') state.authMode = 'login';
      }, 800);
    } catch (e) {
      if (msg) msg.textContent = '网络错误';
      console.error('auth error', e);
    }
  }

  // expose globals used by header and other scripts
  window.openAuth = openAuth;
  window.closeAuth = closeAuth;
  window.toggleAuthMode = toggleAuthMode;
  window.submitAuth = submitAuth;
  window.updateAuthUI = updateAuthUI;

  // auto-initialize if template not yet loaded: wait for DOMContentLoaded
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>{});
})();
