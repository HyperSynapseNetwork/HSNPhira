/* pages: simple SPA router + interaction wiring for pages and room table */
(function () {
  'use strict';

  function showPage(name) {
    document.querySelectorAll('main.page').forEach(p => {
      const dp = p.getAttribute('data-page') || p.className.split('page-')[1];
      if (dp === name || p.classList.contains('page-' + name)) p.style.display = '';
      else p.style.display = 'none';
    });
  }

  function mountNav() {
    document.querySelectorAll('.header .nav-links button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-page');
        showPage(p);
      });
    });

    // default show home
    showPage('home');
  }

  function mountTools() {
    const openBtn = document.getElementById('tool-open-chart');
    if (!openBtn) return;
    openBtn.addEventListener('click', () => {
      const id = document.getElementById('tool-chart-id').value.trim();
      if (!id) return ui.message.toast.show('请输入谱面ID');
      // open chart window (per spec,先检查是否存在应由后端提供；这里直接打开)
      window.windowChart.open(id);
    });
  }

  function mountRoomTableActions() {
    const table = document.getElementById('rooms-table');
    if (!table) return;
    table.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset && btn.dataset.owner) {
        // open phira user page
        const owner = btn.dataset.owner;
        const url = 'https://phira.moe/user/' + encodeURIComponent(owner);
        window.windowLink.open(url, 'Phira: ' + owner);
        return;
      }
      // per-row chart illustration viewer
      if (btn.classList.contains('btn-chart')) {
        const chartId = btn.dataset.chartId;
        if (!chartId) return ui.message && ui.message.toast && ui.message.toast.show('该谱面无 ID');
        (async () => {
          try {
            const external = (window.core && window.core.pageLoader && window.core.pageLoader.config && window.core.pageLoader.config.external_api_base) || 'https://phira.5wyxi.com';
            const res = await fetch((external.replace(/\/$/, '')) + '/chart/' + encodeURIComponent(chartId));
            if (!res.ok) throw new Error('fetch chart failed');
            const j = await res.json();
            const img = j.illustration || j.preview || j.file || '';
            if (!img) return ui.message && ui.message.toast && ui.message.toast.show('未找到曲绘');
            ui.lightbox && ui.lightbox.open && ui.lightbox.open(img);
          } catch (err) {
            console.warn('[pages] fetch chart illustration failed', err);
            ui.message && ui.message.toast && ui.message.toast.show('加载曲绘失败');
          }
        })();
        return;
      }
      // chart button (by text)
      if (btn.classList.contains('btn-capsule')) {
        const chartText = btn.textContent && btn.textContent.trim();
        if (chartText && chartText !== '未选择') {
          // attempt to open by id or name
          window.windowChart.open(chartText);
        }
        return;
      }
      if (btn.classList.contains('btn-rect')) {
        const id = btn.dataset.id;
        // open room detail via windowRoom
        if (window.windowRoom && typeof window.windowRoom.openRoom === 'function') {
          window.windowRoom.openRoom(id);
        } else {
          const win = window.windowBase.create({ title: '房间: ' + id, width: '520px' });
          win.contentEl.innerHTML = '<div class="glass-card">房间详情占位: ' + id + '</div>';
          win.open();
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    mountNav();
    mountTools();
    mountRoomTableActions();
  });

})();
