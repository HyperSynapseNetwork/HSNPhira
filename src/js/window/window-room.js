/* window-room: 房间详情、人员列表与游玩历史窗口 */
(function () {
  'use strict';

  function findRoomByName(name) {
    const pl = window.core && window.core.pageLoader;
    if (!pl || !pl._rooms) return null;
    return pl._rooms.find(r => (r.name === name) || (r.id && String(r.id) === String(name)));
  }

  function openRoomDetail(name) {
    const room = findRoomByName(name);
    const win = window.windowBase.create({ title: '房间: ' + (room ? room.name : name), width: '520px' });
    const content = document.createElement('div');
    content.className = 'room-detail';
    if (!room) {
      content.innerHTML = '<div class="glass-card">房间数据不可用</div>';
      win.contentEl.appendChild(content);
      win.open();
      return win;
    }

    content.innerHTML = `
      <div class="glass-card">
        <h4>${room.name}</h4>
        <p>房主: ${room.data && room.data.host}</p>
        <p>人数: ${(room.data && room.data.users) ? room.data.users.length : '--'}/100</p>
        <div class="room-actions">
          <button class="btn-capsule" id="room-people">查看人员</button>
          <button class="btn-capsule" id="room-history">游玩历史</button>
          <button class="btn-capsule" id="room-illustration">查看曲绘</button>
        </div>
      </div>
    `;
    win.contentEl.appendChild(content);
    win.open();

    content.querySelector('#room-people').addEventListener('click', () => openPeopleWindow(room));
    content.querySelector('#room-history').addEventListener('click', () => openHistoryWindow(room));
    content.querySelector('#room-illustration').addEventListener('click', async () => {
      // fetch chart illustration via external Phira API (per Original Spec: /chart/{chart-id})
      const chartId = room.data && room.data.chart;
      if (!chartId) return ui.message && ui.message.toast && ui.message.toast.show('该房间未选择谱面');
      try {
        const external = (window.core && window.core.pageLoader && window.core.pageLoader.config && window.core.pageLoader.config.external_api_base) || 'https://phira.5wyxi.com';
        const res = await fetch((external.replace(/\/$/, '')) + '/chart/' + encodeURIComponent(chartId));
        if (!res.ok) throw new Error('fetch chart failed');
        const j = await res.json();
        const img = j.illustration || j.preview || j.file || '';
        if (!img) return ui.message && ui.message.toast && ui.message.toast.show('未找到曲绘');
        ui.lightbox && ui.lightbox.open && ui.lightbox.open(img);
      } catch (err) {
        console.warn('[window-room] fetch chart illustration failed', err);
        ui.message && ui.message.toast && ui.message.toast.show('加载曲绘失败');
      }
    });

    return win;
  }

  function openPeopleWindow(room) {
    const win = window.windowBase.create({ title: '房间人员: ' + room.name, width: '420px' });
    const el = document.createElement('div'); el.className = 'room-people';
    el.innerHTML = '<div class="glass-card"><h4>房间成员</h4></div>';
    const list = document.createElement('div'); list.className = 'people-list';
    (room.data && room.data.users || []).forEach(uid => {
      const btn = document.createElement('button'); btn.className = 'btn-capsule'; btn.textContent = uid;
      btn.addEventListener('click', () => window.windowLink.open('https://phira.moe/user/' + encodeURIComponent(uid), 'Phira: ' + uid));
      const wrap = document.createElement('div'); wrap.className = 'people-item'; wrap.appendChild(btn); list.appendChild(wrap);
    });
    el.appendChild(list);
    win.contentEl.appendChild(el);
    win.open();
    return win;
  }

  function openHistoryWindow(room) {
    const win = window.windowBase.create({ title: '游玩历史: ' + room.name, width: '640px', height: '520px' });
    const el = document.createElement('div'); el.className = 'room-history';
    el.innerHTML = '<div class="glass-card"><h4>游玩历史</h4><div class="history-list">加载中...</div></div>';
    win.contentEl.appendChild(el);
    win.open();

    // render rounds if present
    const container = el.querySelector('.history-list');
    container.innerHTML = '';
    const rounds = (room.data && room.data.rounds) || [];
    if (!rounds.length) container.innerHTML = '<div class="small">暂无游玩历史</div>';
    // compute top score(s) across all rounds
    let topScore = -Infinity;
    rounds.forEach(rd => (rd.records || []).forEach(rec => { if (typeof rec.score === 'number' && rec.score > topScore) topScore = rec.score; }));

    rounds.forEach((rd, idx) => {
      const card = document.createElement('div'); card.className = 'glass-card history-round';
      card.innerHTML = `<div class="round-header">谱面: ${rd.chart || '—'}</div>`;
      const rows = document.createElement('div'); rows.className = 'history-records';
      (rd.records || []).forEach(rec => {
        const rdiv = document.createElement('div'); rdiv.className = 'history-record';
        const isTop = (typeof rec.score === 'number' && rec.score === topScore);
        rdiv.innerHTML = `<button class="btn-capsule">${rec.player}</button> <span class="score ${isTop? 'gold-highlight' : ''}">${rec.score}</span>`;
        rows.appendChild(rdiv);
      });
      card.appendChild(rows);
      container.appendChild(card);
    });

    return win;
  }

  window.windowRoom = { openRoom: openRoomDetail, openPeople: openPeopleWindow, openHistory: openHistoryWindow };
})();
