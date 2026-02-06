/* users-page: fetch /api/playtime_leaderboard/top/<limit> and render paginated leaderboard */
(function () {
  'use strict';

  const state = { items: [], page: 1, per_page: 20 };

  function formatMinutes(seconds) {
    if (seconds == null) return '--';
    const m = Number(seconds) / 60;
    return (m >= 60) ? (Math.round(m) + ' 分') : (m.toFixed(1) + ' 分');
  }

  function render() {
    const container = document.getElementById('users-table');
    if (!container) return;
    container.innerHTML = '';
    const start = (state.page - 1) * state.per_page;
    const pageItems = state.items.slice(start, start + state.per_page);

    const tbl = document.createElement('table'); tbl.className = 'table glass3d users-table';
    tbl.innerHTML = '<thead><tr><th>#</th><th>用户ID</th><th>总游玩时间</th><th>操作</th></tr></thead>';
    const tb = document.createElement('tbody');
    pageItems.forEach((it, idx) => {
      const tr = document.createElement('tr');
      const rank = start + idx + 1;
      tr.innerHTML = `<td>${rank}</td><td>${it.user_id}</td><td>${formatMinutes(it.total_playtime)}</td><td><button class="btn-rect" data-user="${it.user_id}">查看</button></td>`;
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    container.appendChild(tbl);

    const pager = document.createElement('div'); pager.className = 'pager';
    pager.innerHTML = `<button class="btn-rect" id="users-prev">上一页</button> <span>第 ${state.page} 页</span> <button class="btn-rect" id="users-next">下一页</button>`;
    container.appendChild(pager);

    container.querySelectorAll('button[data-user]').forEach(b => b.addEventListener('click', () => {
      const uid = b.dataset.user;
      window.windowLink.open('https://phira.moe/user/' + encodeURIComponent(uid), 'Phira: ' + uid);
    }));

    document.getElementById('users-prev').addEventListener('click', () => { if (state.page > 1) { state.page--; render(); } });
    document.getElementById('users-next').addEventListener('click', () => { if ((state.page * state.per_page) < state.items.length) { state.page++; render(); } });
  }

  async function load() {
    const base = (window.core && window.core.pageLoader && window.core.pageLoader.config && window.core.pageLoader.config.api_base_url) || 'http://localhost:7865';
    const limit = 500; // default fetch limit
    const url = `${base.replace(/\/$/, '')}/api/playtime_leaderboard/top/${limit}`;
    const container = document.getElementById('users-table');
    if (container) container.innerHTML = '加载中...';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const j = await res.json();
      // spec: { success: bool, data: [ { user_id, total_playtime } ], timestamp, total_users }
      const items = Array.isArray(j.data) ? j.data : [];
      state.items = items;
      state.page = 1;
      render();
    } catch (err) {
      if (container) container.innerHTML = '<div class="small">无法加载用户排行</div>';
      console.warn('[users-page] fetch error', err);
    }
  }

  document.addEventListener('DOMContentLoaded', load);

})();
