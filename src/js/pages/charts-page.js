/* charts-page: fetch /hot_rank/{time_range} and render table with pagination */
(function () {
  'use strict';

  const state = { time_range: 'day', page: 1, per_page: 20 };

  function renderTable(data) {
    const container = document.getElementById('charts-table');
    if (!container) return;
    container.innerHTML = '';
    const tbl = document.createElement('table'); tbl.className = 'table glass3d charts-table';
    tbl.innerHTML = '<thead><tr><th>#</th><th>谱面ID</th><th>增量</th><th>操作</th></tr></thead>';
    const tbody = document.createElement('tbody');
    (data.results || []).forEach((it, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${(state.page-1)*state.per_page + idx + 1}</td><td>${it.chart_id}</td><td>${it.increase}</td><td><button class="btn-rect" data-chart="${it.chart_id}">打开</button> <button class="btn-capsule copy-id" data-id="${it.chart_id}">复制ID</button></td>`;
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    container.appendChild(tbl);

    const pager = document.createElement('div'); pager.className = 'pager';
    pager.innerHTML = `<button class="btn-rect" id="charts-prev">上一页</button> <span>第 ${data.page} 页</span> <button class="btn-rect" id="charts-next">下一页</button>`;
    container.appendChild(pager);

    // bind actions
    container.querySelectorAll('button[data-chart]').forEach(b => b.addEventListener('click', e => {
      const id = b.dataset.chart;
      window.windowChart.open(id);
    }));
    container.querySelectorAll('.copy-id').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.id;
      try { await navigator.clipboard.writeText('#' + id); ui.message.toast.show('已复制 #' + id); }
      catch (err) { ui.message.toast.show('复制失败'); }
    }));

    document.getElementById('charts-prev').addEventListener('click', () => { if (state.page>1) { state.page--; fetchAndRender(); } });
    document.getElementById('charts-next').addEventListener('click', () => { state.page++; fetchAndRender(); });
  }

  async function fetchAndRender() {
    const base = (window.core && window.core.pageLoader && window.core.pageLoader.config && window.core.pageLoader.config.api_base_url) || 'http://localhost:7865';
    const url = `${base.replace(/\/$/, '')}/hot_rank/${encodeURIComponent(state.time_range)}?page=${state.page}&per_page=${state.per_page}`;
    const container = document.getElementById('charts-table');
    if (container) container.innerHTML = '加载中...';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const j = await res.json();
      renderTable(j);
    } catch (err) {
      if (container) container.innerHTML = '<div class="small">无法加载排行</div>';
      console.warn('[charts-page] fetch error', err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => { fetchAndRender(); });

})();
