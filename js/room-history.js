// Room play-history window
(function(){
  async function openRoomHistory(roomId){
    if (!roomId) { showMessage && showMessage('错误','未提供房间标识'); return; }

    // load template
    let tplText = '';
    try{
      const r = await fetch('./component/room-history.html');
      tplText = await r.text();
    }catch(e){ tplText = ''; }
    const wrapper = document.createElement('div');
    wrapper.innerHTML = tplText;
    const tpl = wrapper.querySelector('#room-history-template');
    if (!tpl) { showMessage && showMessage('错误','无法加载历史模板'); return; }

    const win = document.createElement('mac-window');
    win.style.setProperty('--width','680px');
    win.style.setProperty('--height','420px');
    document.body.appendChild(win);

    const content = tpl.content.cloneNode(true);
    const container = document.createElement('div');
    container.appendChild(content);
    win.appendChild(container);

    const meta = win.querySelector('#history-meta');
    const tbody = win.querySelector('#history-table tbody');
    if (meta) meta.textContent = `房间：${roomId}`;

    // try multiple endpoints
    const candidates = [`/api/rooms/history/${encodeURIComponent(roomId)}`, `/api/rooms/history?room=${encodeURIComponent(roomId)}`];
    let data = null;
    for (const url of candidates){
      try{
        const r = await fetch(url);
        if (!r.ok) continue;
        data = await r.json();
        break;
      }catch(e){}
    }

    if (!Array.isArray(data) || data.length === 0){
      tbody.innerHTML = '<tr><td colspan="4" class="history-empty">暂无历史记录</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(item => {
      const player = item.player_name || item.player || item.user || '匿名';
      const chart = item.chart_name || item.chart || item.song || '未知';
      const score = item.score != null ? item.score : (item.result || '—');
      const t = item.time || item.ts || item.played_at || '';
      return `<tr><td>${player}</td><td>${chart}</td><td>${score}</td><td>${t}</td></tr>`;
    }).join('');
  }

  window.openRoomHistory = openRoomHistory;
})();
