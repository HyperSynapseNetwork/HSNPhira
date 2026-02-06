/* window-chart: 显示谱面详情并支持下载（基于 Phira 外部 API） */
(function () {
  'use strict';

  async function fetchChart(chartId, externalBase) {
    const base = externalBase || (window.__config && window.__config.external_api_base) || 'https://phira.5wyxi.com';
    const url = base.replace(/\/$/, '') + '/chart/' + encodeURIComponent(chartId);
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch chart failed');
    return await res.json();
  }

  async function openChartWindow(chartId) {
    const win = window.windowBase.create({ title: '谱面详情: ' + chartId, width: '1000px', height: '700px' });
    const content = document.createElement('div');
    content.className = 'chart-window';
    content.innerHTML = '<div class="loading">加载中...</div>';
    win.contentEl.appendChild(content);
    win.open();

    try {
      const chart = await fetchChart(chartId);
      content.innerHTML = `
        <div class="chart-left">
          <img src="${chart.illustration || ''}" alt="cover" class="chart-img" />
        </div>
        <div class="chart-right">
          <h3>${chart.name || '未知谱面'}</h3>
          <p>ID: #${chart.id}</p>
          <p>难度: ${chart.level || chart.difficulty || '—'}</p>
          <p>谱师: ${chart.charter || chart.composer || '—'}</p>
          <p>${chart.description || ''}</p>
          <div class="chart-actions">
            <button class="btn-rect" id="download-chart">下载谱面</button>
            <button class="btn-rect" id="download-image">下载曲绘</button>
            <button class="btn-rect" id="play-preview">播放预览</button>
          </div>
          <div id="preview-player" style="margin-top:8px"></div>
        </div>
      `;
      // attach behaviors
      const downloadBlob = async (url, filename) => {
        if (!url) return ui.message && ui.message.toast && ui.message.toast.show('无可下载资源');
        try {
          const start = Date.now();
          const res = await fetch(url);
          if (!res.ok) throw new Error('fetch failed');
          const blob = await res.blob();
          const ext = (url.split('.').pop().split('?')[0]) || '';
          const a = document.createElement('a');
          const blobUrl = URL.createObjectURL(blob);
          a.href = blobUrl;
          a.download = filename || (`${(chart.name||'chart')}.${ext}`);
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
          const took = Date.now() - start;
          ui.message && ui.message.toast && ui.message.toast.show('下载已开始（耗时 ' + took + 'ms）');
        } catch (err) {
          console.warn('[window-chart] download failed', err);
          ui.message && ui.message.toast && ui.message.toast.show('下载失败');
        }
      };

      const btnDownloadChart = content.querySelector('#download-chart');
      const btnDownloadImage = content.querySelector('#download-image');
      const btnPlay = content.querySelector('#play-preview');
      const playerContainer = content.querySelector('#preview-player');

      if (btnDownloadChart) btnDownloadChart.addEventListener('click', () => downloadBlob(chart.file, `${(chart.name||'chart')}.zip`));
      if (btnDownloadImage) btnDownloadImage.addEventListener('click', () => downloadBlob(chart.illustration, `${(chart.name||'chart')}.png`));
      if (btnPlay) btnPlay.addEventListener('click', async () => {
        if (!chart.preview) return ui.message && ui.message.toast && ui.message.toast.show('无预览音频');
        // create audio player
        playerContainer.innerHTML = '';
        const audio = document.createElement('audio'); audio.controls = true; audio.src = chart.preview; audio.autoplay = true; audio.style.width = '100%';
        playerContainer.appendChild(audio);
      });
    } catch (err) {
      content.innerHTML = '<div class="error">无法获取谱面信息</div>';
      console.warn('[window-chart] fetch error', err);
    }

    return win;
  }

  window.windowChart = { open: openChartWindow };
})();
