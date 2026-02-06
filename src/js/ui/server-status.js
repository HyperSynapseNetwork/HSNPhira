
/* ui.serverStatus - fetch /status and render server info; provide copy buttons for QQ and address */
(function () {
  'use strict';

  function safeCopy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy'); ta.remove(); resolve();
      } catch (e) { reject(e); }
    });
  }

  async function fetchStatus(base) {
    const url = (base.replace(/\/$/, '')) + '/status';
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error('status fetch failed');
      const j = await res.json();
      return j;
    } catch (err) {
      console.warn('[ui.serverStatus] fetch /status failed', err);
      return null;
    }
  }

  function renderStatus(root, data) {
    if (!root) return;
    if (!data) {
      root.innerHTML = '<div class="small muted">无法获取服务器状态</div>';
      return;
    }
    const online = data.online === true;
    const color = online ? '#16a34a' : '#dc2626';
    const lines = [];
    lines.push(`<div style="display:flex;align-items:center;gap:8px"><span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block"></span><strong>${online? '在线' : '离线'}</strong></div>`);
    if (typeof data.latency_ms !== 'undefined') lines.push(`<div>延迟: ${data.latency_ms} ms</div>`);
    if (data.server_name) lines.push(`<div>服务器: ${data.server_name}</div>`);
    if (data.last_check) lines.push(`<div class="small muted">更新时间: ${data.last_check}</div>`);
    root.innerHTML = lines.join('');
  }

  async function init() {
    const root = document.getElementById('server-status');
    const qqEl = document.getElementById('server-qq');
    const addrEl = document.getElementById('server-address');
    const copyQ = document.getElementById('copy-qq');
    const copyA = document.getElementById('copy-address');

    const defaultQQ = '1049578201';
    if (qqEl && !qqEl.textContent.trim()) qqEl.textContent = defaultQQ;

    // address default from config or displayed element
    const defaultAddr = (window.core && window.core.pageLoader && window.core.pageLoader.config && window.core.pageLoader.config.api_base_url) || (addrEl && addrEl.textContent) || 'service.htadiy.com:7865';
    if (addrEl && !addrEl.textContent.trim()) addrEl.textContent = defaultAddr;

    if (copyQ) copyQ.addEventListener('click', async () => {
      const text = qqEl ? qqEl.textContent.trim() : defaultQQ;
      try { await safeCopy(text); ui.message && ui.message.toast && ui.message.toast.show('已复制 QQ: ' + text); } catch (e) { ui.message && ui.message.toast && ui.message.toast.show('复制失败'); }
    });

    if (copyA) copyA.addEventListener('click', async () => {
      const text = addrEl ? addrEl.textContent.trim() : defaultAddr;
      try { await safeCopy(text); ui.message && ui.message.toast && ui.message.toast.show('已复制 地址: ' + text); } catch (e) { ui.message && ui.message.toast && ui.message.toast.show('复制失败'); }
    });

    // initial fetch and periodic refresh
    async function poll() {
      const base = (window.core && window.core.pageLoader && window.core.pageLoader.config && window.core.pageLoader.config.api_base_url) || defaultAddr.replace(/^https?:\/\//, '');
      // ensure base has protocol for fetch
      const fetchBase = (base.indexOf('http') === 0) ? base : ('http://' + base);
      const data = await fetchStatus(fetchBase);
      renderStatus(root, data);
    }

    // run poll now and every 30s
    poll();
    setInterval(poll, 30000);
  }

  document.addEventListener('DOMContentLoaded', () => { try { init(); } catch (e) { console.warn('[ui.serverStatus] init error', e); } });

  window.ui = window.ui || {};
  window.ui.serverStatus = { init };

})();
