/* window-setting: 用户偏好设置窗口（基于 user_preferences_schema.json 渲染） */
(function () {
  'use strict';

  async function openSettingWindow() {
    const win = window.windowBase.create({ title: '页面偏好设置', width: '720px', height: '520px' });
    const content = document.createElement('div');
    content.className = 'setting-window';
    content.innerHTML = '<div class="loading">加载设置...</div>';
    win.contentEl.appendChild(content);
    win.open();

    try {
      const res = await fetch('config/user_preferences_schema.json', { cache: 'no-cache' });
      const schema = await res.json();
      // render simple form
      const form = document.createElement('div');
      form.className = 'prefs-form';
      form.innerHTML = '';
      (schema.groups || []).forEach(g => {
        const groupEl = document.createElement('div');
        groupEl.className = 'prefs-group';
        groupEl.innerHTML = `<h4>${g.name_zh || g.name}</h4><div class="prefs-items"></div>`;
        form.appendChild(groupEl);
      });
      (schema.preferences || []).forEach(p => {
        const group = form.querySelector('.prefs-group .prefs-items') || form.querySelector('.prefs-group:last-child .prefs-items');
        const item = document.createElement('div');
        item.className = 'pref-item';
        item.innerHTML = `<label>${p.name_zh || p.name}</label>`;
        if (p.type === 'boolean') {
          const input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!p.default; item.appendChild(input);
        } else if (p.type === 'free') {
          const input = document.createElement('input'); input.type = 'text'; input.value = p.default || ''; item.appendChild(input);
        }
        group.appendChild(item);
      });

      content.innerHTML = '';
      content.appendChild(form);
      const footer = document.createElement('div'); footer.className = 'prefs-footer';
      const saveBtn = document.createElement('button'); saveBtn.className = 'btn-rect'; saveBtn.textContent = '保存';
      saveBtn.addEventListener('click', () => { window.ui && ui.message && ui.message.toast && ui.message.toast.show('保存已完成（示意）', { duration: 1200 }); });
      footer.appendChild(saveBtn);
      content.appendChild(footer);
    } catch (err) {
      content.innerHTML = '<div class="error">无法加载偏好配置</div>';
      console.warn('[window-setting] load schema error', err);
    }

    return win;
  }

  window.windowSetting = { open: openSettingWindow };
})();
