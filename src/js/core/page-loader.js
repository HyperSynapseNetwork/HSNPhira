/*
  core.pageLoader
  - 按规范初始化流程：加载配置 -> 注册组件 -> 首次渲染 -> 启用动效
*/
(function () {
  'use strict';

  const DEFAULT_CONFIG_PATH = 'config/app_config.json';

  const core = window.core || (window.core = {});

  const corePageLoader = {
    config: null,
    async loadConfig() {
      try {
        const res = await fetch(DEFAULT_CONFIG_PATH, {cache: 'no-cache'});
        this.config = await res.json();
      } catch (err) {
        console.warn('[core.pageLoader] 无法加载配置，使用默认 mock 配置', err);
        this.config = { api_mode: 'mock' };
      }
    },

    registerComponents() {
      // 组件注册点：在实际应用中，这里应动态注册所有组件
      // 目前仅确保 ui.message.toast 已就绪
      if (!window.ui || !window.ui.message || !window.ui.message.toast) {
        console.warn('[core.pageLoader] ui.message.toast 未注册');
      }
    },

    async fetchVisitedCount() {
      const mode = this.config && this.config.api_mode;
      const base = (this.config && this.config.api_base_url) || 'http://localhost:7865';
      if (mode === 'local' || mode === 'remote') {
        const url = (base.replace(/\/$/, '')) + '/api/auth/visited/count';
        try {
          const res = await fetch(url, { cache: 'no-cache' });
          const ct = res.headers.get('content-type') || '';
          // 原始规格说明该接口返回一个整数（纯整数或 JSON 数字），这里尝试兼容多种格式
          if (ct.includes('application/json')) {
            const j = await res.json();
            // 支持直接返回数字或 { count: n }
            if (typeof j === 'number') return j;
            if (j && typeof j.count === 'number') return j.count;
            console.warn('[core.pageLoader] /api/auth/visited/count 返回的 JSON 不包含预期数字', j);
            return null;
          } else {
            const txt = await res.text();
            const n = parseInt(txt, 10);
            if (!Number.isNaN(n)) return n;
            console.warn('[core.pageLoader] /api/auth/visited/count 返回不可解析的文本', txt);
            return null;
          }
        } catch (err) {
          console.warn('[core.pageLoader] 请求 /api/auth/visited/count 失败，返回 null', err);
          return null;
        }
      }

      // mock fallback
      return 1234;
    },

    renderVisited(count) {
      const el = document.getElementById('visited-count');
      if (el) el.textContent = '已访问: ' + (count == null ? '--' : count);
    },

    renderRooms(rooms) {
      const tbody = document.querySelector('#rooms-table tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      rooms.forEach(r => {
        const name = r.name || (r.data && r.data.name) || '—';
        // owner: prefer data.host per spec
        const owner = (r.data && (r.data.host || r.data.host === 0 ? r.data.host : null)) || r.owner || '—';
        const usersLen = (r.data && Array.isArray(r.data.users)) ? r.data.users.length : (r.count || '--');
        const chart = (r.data && (r.data.chart !== undefined && r.data.chart !== null)) ? r.data.chart : (r.chart || '未选择');
        // status / cycle / lock
        const status = (r.data && r.data.state) ? String(r.data.state) : (r.state || '—');
        const cycle = (r.data && typeof r.data.cycle !== 'undefined') ? (r.data.cycle ? '是' : '否') : (typeof r.cycle !== 'undefined' ? (r.cycle ? '是' : '否') : '—');
        const lock = (r.data && typeof r.data.lock !== 'undefined') ? (r.data.lock ? '是' : '否') : (typeof r.lock !== 'undefined' ? (r.lock ? '是' : '否') : '—');
        const tr = document.createElement('tr');
        // build a small chart-button HTML (only when chart available)
        const chartBtn = (chart && chart !== '未选择') ? `<button class="btn-chart" data-chart-id="${chart}" title="查看曲绘">🖼</button>` : '<span class="small muted">—</span>';
        // status badge class
        const statusClass = (status && typeof status === 'string') ? `status-${status.toLowerCase().replace(/[^a-z0-9]+/g,'-')}` : '';
        tr.innerHTML = `
          <td>${name}</td>
          <td><button class="btn-capsule" data-owner="${owner}">${owner}</button></td>
          <td>${usersLen}/100</td>
          <td><span class="badge ${statusClass}" title="${status}">${status}</span></td>
          <td>${cycle}</td>
          <td>${lock}</td>
          <td><button class="btn-capsule">${chart}</button></td>
          <td>${chartBtn}</td>
          <td><button class="btn-rect" data-id="${name}">查看</button></td>
        `;
        tbody.appendChild(tr);
      });
    },

    async loadInitialData() {
      const mode = this.config && this.config.api_mode;
      const base = (this.config && this.config.api_base_url) || 'http://localhost:7865';
      if (mode === 'local' || mode === 'remote') {
        try {
          const res = await fetch((base.replace(/\/$/, '')) + '/api/rooms/info', { cache: 'no-cache' });
          if (res.ok) {
            const j = await res.json();
            // expected array per spec
            if (Array.isArray(j)) {
              // map to rendering format
              const rooms = j.map((it, idx) => ({ id: idx+1, name: it.name, data: it.data }));
              this._rooms = rooms;
              this.renderRooms(rooms);
            } else {
              console.warn('[core.pageLoader] /api/rooms/info 返回非数组，使用 mock');
              this._rooms = null;
              this.renderRooms([]);
            }
          } else {
            console.warn('[core.pageLoader] /api/rooms/info 请求失败，使用 mock');
            this._rooms = null;
            this.renderRooms([]);
          }
        } catch (err) {
          console.warn('[core.pageLoader] 请求 /api/rooms/info 异常，使用 mock', err);
          this._rooms = null;
          this.renderRooms([]);
        }
      } else {
        // mock rooms
        const rooms = [
          { id: 1, name: '房间 A', owner: 'Alice', count: 12, chart: '曲目X' },
          { id: 2, name: '房间 B', owner: 'Bob', count: 4, chart: null }
        ];
        this._rooms = rooms;
        this.renderRooms(rooms);
      }
    },

    initRoomsSSE() {
      const base = (this.config && this.config.api_base_url) || 'http://localhost:7865';
      const handlers = {
        onOpen: () => console.info('[core.pageLoader] rooms SSE open'),
        onError: e => console.warn('[core.pageLoader] rooms SSE error', e),
        onEvent: (evt, payload) => {
          // validate payload per spec
          const valid = (window.core && window.core.sseValidate && window.core.sseValidate.validate) ? window.core.sseValidate.validate(evt, payload) : true;
          if (!valid) { console.warn('[core.pageLoader] SSE payload failed validation', evt, payload); return; }
          // update last event time (heartbeat)
          this._lastEventTime = Date.now();

          // evt: create_room | update_room | player_score | join_room | leave_room | start_round
          if (evt === 'create_room') {
            const room = { id: (this._rooms ? this._rooms.length + 1 : 1), name: payload.room, data: payload.data };
            this._rooms = this._rooms || [];
            this._rooms.push(room);
            this.renderRooms(this._rooms);
            ui.message && ui.message.toast && ui.message.toast.show('新房间: ' + payload.room, { duration: 2000 });
          } else if (evt === 'update_room') {
            if (!this._rooms) return;
            const idx = this._rooms.findIndex(r => r.name === payload.room);
            if (idx >= 0) {
              const r = this._rooms[idx];
              r.data = Object.assign({}, r.data || {}, payload.data || {});
              this.renderRooms(this._rooms);
            }
          } else if (evt === 'player_score') {
            ui.message && ui.message.toast && ui.message.toast.show('新游玩成绩: ' + (payload.record && payload.record.score), { duration: 1600 });
          }
        }
      };

      try {
        this._sse = core.sseClient.connect('/api/rooms/listen', handlers, { base });
        // heartbeat / stale check: if no events for 35s, reconnect
        this._lastEventTime = Date.now();
        if (this._sseCheckInterval) clearInterval(this._sseCheckInterval);
        this._sseCheckInterval = setInterval(() => {
          try {
            const now = Date.now();
            if (this._lastEventTime && (now - this._lastEventTime) > 35000) {
              console.warn('[core.pageLoader] SSE heartbeat timeout, reconnecting');
              try { if (this._sse && this._sse.close) this._sse.close(); } catch (e) {}
              this._sse = core.sseClient.connect('/api/rooms/listen', handlers, { base });
              this._lastEventTime = Date.now();
            }
          } catch (e) { console.warn('[core.pageLoader] SSE check error', e); }
        }, 10000);
      } catch (err) {
        console.warn('[core.pageLoader] 无法连接 SSE', err);
      }
    },

    enableInteractions() {
      // 简单的 3D 倾斜效果监听实现
      document.querySelectorAll('.glass-card, .btn-capsule').forEach(el => {
        el.addEventListener('mousemove', e => {
          const rect = el.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width - 0.5;
          const y = (e.clientY - rect.top) / rect.height - 0.5;
          el.style.transform = `perspective(800px) rotateX(${ -y * 6 }deg) rotateY(${ x * 6 }deg)`;
        });
        el.addEventListener('mouseleave', () => { el.style.transform = ''; });
      });
    },

    async init() {
      await this.loadConfig();
      // show global loader until initial data loaded
      try { ui && ui.loader && ui.loader.show && ui.loader.show('初始化中...'); } catch (e) {}
      this.registerComponents();
      const visited = await this.fetchVisitedCount();
      this.renderVisited(visited);
      await this.loadInitialData();
      this.enableInteractions();
      // 启动房间 SSE 以接收实时更新（按 Original Spec 的 /api/rooms/listen）
      try { this.initRoomsSSE(); } catch (e) { console.warn('[core.pageLoader] initRoomsSSE failed', e); }
      try { ui && ui.loader && ui.loader.hide && ui.loader.hide(); } catch (e) {}
      console.info('[core.pageLoader] 初始化完成');
    }
  };

  window.core = window.core || {};
  window.core.pageLoader = corePageLoader;
  window.corePageLoader = corePageLoader;

})();
