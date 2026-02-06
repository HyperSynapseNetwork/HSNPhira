/*
  core.auth
  - 实现基于原始规格的登录/退出/当前用户查询
  - 假设：后端采用基于 Cookie 的会话（无 Bearer token 返回）。此为保守默认，可在后端要求下改为 token 存储。
*/
(function () {
  'use strict';

  const core = window.core || (window.core = {});

  const auth = {
    currentUser: null,
    async login(username, password, remember) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username, password, remember: !!remember })
        });
        if (!res.ok) throw new Error('登录失败');
        // 尝试解析返回的用户信息（原文说明响应为 /api/auth/me 格式）
        const j = await res.json();
        this.currentUser = j;
        window.core && core.eventBus && core.eventBus.emit && core.eventBus.emit('auth:login', j);
        return j;
      } catch (err) {
        console.error('[core.auth] login error', err);
        throw err;
      }
    },

    async logout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch (err) { console.warn('[core.auth] logout request failed', err); }
      this.currentUser = null;
      core.eventBus && core.eventBus.emit && core.eventBus.emit('auth:logout', null);
    },

    async me() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) return null;
        const j = await res.json();
        this.currentUser = j;
        return j;
      } catch (err) {
        console.warn('[core.auth] me error', err);
        return null;
      }
    },

    // register: POST /api/auth/users returns an SSE-like stream in response body
    // Returns an object { on(event, cb), close() } to allow UI to react to validating/timeout/success/error
    register(opts) {
      const controller = { _cbs: {}, _closed: false, _reader: null, close() { this._closed = true; if (this._reader && this._reader.cancel) this._reader.cancel(); } };
      controller.on = function (evt, cb) { (this._cbs[evt] = this._cbs[evt] || []).push(cb); };
      (async () => {
        try {
          const res = await fetch('/api/auth/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(opts || {})
          });
          if (!res.ok) {
            (controller._cbs.error || []).forEach(f => f('请求失败'));
            return;
          }
          const reader = res.body.getReader(); controller._reader = reader;
          const decoder = new TextDecoder('utf-8');
          let buf = '';
          while (!controller._closed) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            // parse SSE chunks (simple parser)
            let idx;
            while ((idx = buf.indexOf('\n\n')) >= 0) {
              const block = buf.slice(0, idx).trim();
              buf = buf.slice(idx + 2);
              const lines = block.split(/\r?\n/);
              let ev = 'message', data = '';
              lines.forEach(l => {
                if (l.startsWith('event:')) ev = l.replace(/^event:\s*/, '').trim();
                else if (l.startsWith('data:')) data += l.replace(/^data:\s*/, '') + '\n';
              });
              data = data.trim();
              // dispatch
              (controller._cbs[ev] || []).forEach(cb => cb(data));
            }
          }
        } catch (err) {
          (controller._cbs.error || []).forEach(f => f(String(err)));
        }
      })();
      return controller;
    },

    getCurrent() { return this.currentUser; }
  };

  core.auth = auth;
})();
