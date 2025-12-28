    // 全局变量
    let allUsers = [];
    let currentUser = null;
    // 用户组管理相关
    let allGroups = [];
  // 管理员密码（用于批量接口验证），在 verifyAdminPassword() 验证后设置
  let adminPassword = '';

    // 等待页面关键内容与资源就绪（用户/用户组渲染 & 图片加载）
    async function waitForAppReady(maxWait = 5000) {
      const start = Date.now();
      const usersBody = () => document.getElementById('users-table-body');
      const groupsList = () => document.getElementById('groups-list');

      function imagesLoaded() {
        const imgs = Array.from(document.images || []);
        return imgs.length === 0 || imgs.every(i => i.complete);
      }

      while (Date.now() - start < maxWait) {
        const usersReady = usersBody() && usersBody().children.length > 0;
        const groupsReady = groupsList() && groupsList().children.length > 0;
        if ((usersReady || groupsReady) && imagesLoaded()) return;
        // small delay and retry
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 80));
      }
    }

    // 页面初始化：确保数据加载并在资源就绪后再隐藏加载器
    document.addEventListener('DOMContentLoaded', async () => {
      const loader = document.getElementById('page-loader');
      loader.classList.remove('hide');

      // 获取当前用户信息
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) throw new Error('未登录');
        currentUser = await res.json();
        updateUserDisplay();
      } catch (e) {
        alert('请先登录');
        window.location.href = 'index.html';
        return;
      }

      // 加载用户列表与用户组列表
      await Promise.all([loadAllUsers(), loadAllGroups()]);

      // 等待页面主要内容与图片渲染完成再淡出加载器
      await waitForAppReady(5000);
      // 给 CSS 过渡一点时间
      setTimeout(() => loader.classList.add('hide'), 80);
    });

    // 加载所有用户数据
    async function loadAllUsers() {
      try {
        const res = await fetch('/api/auth/users');
        if (!res.ok) throw new Error('加载用户失败');
        allUsers = await res.json();
        document.getElementById('total-users').textContent = allUsers.length;
        renderUsersTable(allUsers);
      } catch (e) {
        showAdminMessage('加载用户失败', false);
      }
    }
    
    // 渲染用户表格（兼容新API）
    function renderUsersTable(users) {
      const tableBody = document.getElementById('users-table-body');
      tableBody.innerHTML = '';
      const searchName = document.getElementById('search-name').value.toLowerCase();
      const searchPhira = document.getElementById('search-phira').value.toLowerCase();
      // 过滤用户
      const filteredUsers = users.filter(user => {
        const nameMatch = (user.username || '').toLowerCase().includes(searchName);
        const phiraMatch = (String(user.phira_id) || '').toLowerCase().includes(searchPhira);
        return nameMatch && phiraMatch;
      });
      filteredUsers.forEach(user => {
        const row = document.createElement('tr');
        row.className = 'user-row';
        row.innerHTML = `
          <td><input type="checkbox" class="user-select" data-id="${user.id}" /></td>
          <td>${user.id}</td>
          <td>${user.username}</td>
          <td><img src="${user.phira_avatar || 'https://phira.moe/assets/user-6212ee95.png'}" class="user-avatar-small" /></td>
          <td>${user.phira_id || '-'}</td>
          <td>${user.phira_username || '-'}</td>
          <td>${user.phira_rks ? parseFloat(user.phira_rks).toFixed(2) : '0.00'}</td>
          <td>
            ${user.group_id === 1 ? '<span class="badge badge-admin">超级管理员</span>' : ''}
            ${user.group_id === 2 ? '<span class="badge badge-admin">管理员</span>' : ''}
            ${(user.group_id === 1 || user.group_id === 2) ? '<span class="badge badge-dev">开发者</span>' : ''}
          </td>
          <td class="actions-cell">
            <button class="action-btn btn-edit" onclick="openEditModal(${user.id})">编辑</button>
            <button class="action-btn" onclick="deleteUser(${user.id})">删除</button>
          </td>
        `;
        tableBody.appendChild(row);
      });
    }
    
    // 打开编辑用户模态框（兼容新API）
    function openEditModal(userId) {
      const user = allUsers.find(u => u.id === userId);
      if (!user) return;
      document.getElementById('edit-user-id').value = user.id;
      document.getElementById('edit-username').value = user.username;
      document.getElementById('edit-phira-id').value = user.phira_id || '';
      document.getElementById('edit-admin').value = (user.group_id === 1 || user.group_id === 2) ? 'yes' : 'no';
      document.getElementById('edit-dev').value = (user.group_id === 1 || user.group_id === 2) ? 'yes' : 'no';
      document.getElementById('edit-message').style.display = 'none';
      document.getElementById('edit-modal').style.display = 'flex';
    }
    
    // 关闭编辑用户模态框
    function closeEditModal() {
      document.getElementById('edit-modal').style.display = 'none';
    }
    
    // 切换密码显示
    function togglePasswordDisplay() {
      const display = document.getElementById('password-display');
      if (display.textContent === '************') {
        display.textContent = display.dataset.original;
      } else {
        display.textContent = '************';
      }
    }
    
    // 保存用户更改（兼容新API，增加current_password）
    async function saveUserChanges() {
      const userId = parseInt(document.getElementById('edit-user-id').value);
      const username = document.getElementById('edit-username').value;
      const password = document.getElementById('edit-password').value;
      const phiraId = document.getElementById('edit-phira-id').value;
      const admin = document.getElementById('edit-admin').value;
      const dev = document.getElementById('edit-dev').value;
      const current_password = document.getElementById('edit-current-password').value;
      let group_id = 3;
      if (admin === 'yes') group_id = 2;
      if (dev === 'yes') group_id = 2;
      if (admin === 'yes' && dev === 'yes') group_id = 1;
      const changes = { username, phira_id: phiraId, group_id, current_password };
      if (password) changes.password = password;
      try {
        const res = await fetch(`/api/auth/users/${userId}`, {
          method: 'PATCH',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(changes)
        });
        if (!res.ok) throw new Error('更新失败');
        showEditMessage('用户信息更新成功', true);
        setTimeout(() => {
          closeEditModal();
          loadAllUsers();
        }, 1500);
      } catch (e) {
        showEditMessage('更新失败', false);
      }
    }
    // 删除用户（新API）
    async function deleteUser(userId) {
      if (!confirm('确定要删除该用户吗？')) return;
      try {
        const res = await fetch(`/api/auth/users/${userId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('删除失败');
        showAdminMessage('用户已删除', true);
        loadAllUsers();
      } catch (e) {
        showAdminMessage('删除失败', false);
      }
    }
    
    // 显示编辑消息
    function showEditMessage(message, isSuccess) {
      const messageElement = document.getElementById('edit-message');
      messageElement.textContent = message;
      messageElement.className = `message ${isSuccess ? 'message-success' : 'message-error'}`;
      messageElement.style.display = 'block';
    }
    
    // 全选用户
    function selectAllUsers() {
      document.querySelectorAll('.user-select').forEach(checkbox => {
        checkbox.checked = true;
      });
    }
    
    // 取消全选
    function deselectAllUsers() {
      document.querySelectorAll('.user-select').forEach(checkbox => {
        checkbox.checked = false;
      });
    }
    
    // 应用批量操作
    function applyBatchAction() {
      const action = document.getElementById('batch-action').value;
      const selectedUserIds = [];
      
      document.querySelectorAll('.user-select:checked').forEach(checkbox => {
        if (checkbox.id !== 'select-all') {
          selectedUserIds.push(parseInt(checkbox.dataset.id));
        }
      });
      
      if (selectedUserIds.length === 0) {
        showAdminMessage('请选择至少一个用户', false);
        return;
      }
      
      // 确定要应用的更改
      let changes = {};
      switch (action) {
        case 'set_admin':
          changes.admin = 'yes';
          break;
        case 'remove_admin':
          changes.admin = 'no';
          break;
        case 'set_dev':
          changes.dev = 'yes';
          break;
        case 'remove_dev':
          changes.dev = 'no';
          break;
      }
      
      // 如果尚未输入管理员密码，弹出管理员密码模态框要求验证
      if (!adminPassword) {
        // 打开管理员密码模态框，验证后回调继续操作
        document.getElementById('admin-password-modal').style.display = 'flex';
        document.getElementById('admin-password-message').style.display = 'none';
        // 绑定一次性验证通过后继续提交的回调
        window._afterAdminVerified = () => {
          // 重新调用 applyBatchAction 并保留 adminPassword
          applyBatchAction();
          delete window._afterAdminVerified;
        };
        return;
      }

      fetch('/admin/batch-update', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          current_password: adminPassword,
          user_ids: selectedUserIds,
          changes
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          // 统计成功和失败的数量
          const successCount = data.results.filter(r => r.status === 'success').length;
          const errorCount = data.results.filter(r => r.status === 'error').length;
          
          if (errorCount === 0) {
            showAdminMessage(`成功更新 ${successCount} 个用户`, true);
          } else {
            showAdminMessage(`成功更新 ${successCount} 个用户，失败 ${errorCount} 个`, false);
          }
          
          // 重新加载用户数据
          loadAllUsers();
        } else {
          showAdminMessage(data.message || '批量更新失败', false);
        }
      })
      .catch(error => {
        showAdminMessage('网络错误，请重试', false);
      });
    }
    
    // 显示管理员消息
    function showAdminMessage(message, isSuccess) {
      const messageElement = document.getElementById('admin-message');
      messageElement.textContent = message;
      messageElement.className = `message ${isSuccess ? 'message-success' : 'message-error'}`;
      messageElement.style.display = 'block';
      
      // 5秒后隐藏消息
      setTimeout(() => {
        messageElement.style.display = 'none';
      }, 5000);
    }
    
    // 加载所有用户组数据
    async function loadAllGroups() {
      try {
        const res = await fetch('/api/auth/groups');
        if (!res.ok) throw new Error('加载用户组失败');
        allGroups = await res.json();
        renderGroupsList(allGroups);
      } catch (e) {
        showGroupsMessage('加载用户组失败', false);
      }
    }
    // 渲染用户组列表
    function renderGroupsList(groups) {
      const list = document.getElementById('groups-list');
      list.innerHTML = '';
      groups.forEach(group => {
        const card = document.createElement('div');
        card.className = 'info-card';
        card.innerHTML = `
          <div class="info-title">ID: ${group.id}</div>
          <div class="info-value">${group.name}</div>
          <div class="info-value">权限: ${group.permissions}</div>
          <div class="form-actions">
            <button class="btn" onclick="openEditGroupModal(${group.id})">编辑</button>
            <button class="btn btn-outline" onclick="deleteGroup(${group.id})">删除</button>
          </div>
        `;
        list.appendChild(card);
      });
    }
    function showGroupsMessage(msg, isSuccess) {
      const el = document.getElementById('groups-message');
      el.textContent = msg;
      el.className = 'message ' + (isSuccess ? 'message-success' : 'message-error');
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 5000);
    }
    function openCreateGroupModal() {
      document.getElementById('group-modal-title').textContent = '创建用户组';
      document.getElementById('group-id').value = '';
      document.getElementById('group-name').value = '';
      document.getElementById('group-permissions').value = '';
      document.getElementById('group-password-area').style.display = 'none';
      document.getElementById('group-modal').style.display = 'flex';
      document.getElementById('group-modal-message').style.display = 'none';
      document.getElementById('group-modal-save-btn').onclick = saveGroupChanges;
    }
    function openEditGroupModal(id) {
      const group = allGroups.find(g => g.id === id);
      if (!group) return;
      document.getElementById('group-modal-title').textContent = '编辑用户组';
      document.getElementById('group-id').value = group.id;
      document.getElementById('group-name').value = group.name;
      document.getElementById('group-permissions').value = group.permissions;
      document.getElementById('group-password-area').style.display = 'block';
      document.getElementById('group-modal').style.display = 'flex';
      document.getElementById('group-modal-message').style.display = 'none';
      document.getElementById('group-modal-save-btn').onclick = saveGroupChanges;
    }
    function closeGroupModal() {
      document.getElementById('group-modal').style.display = 'none';
    }
    async function saveGroupChanges() {
      const id = document.getElementById('group-id').value;
      const name = document.getElementById('group-name').value;
      const permissions = parseInt(document.getElementById('group-permissions').value);
      const current_password = document.getElementById('group-current-password').value;
      const msgEl = document.getElementById('group-modal-message');
      msgEl.style.display = 'none';
      if (!name || isNaN(permissions)) {
        msgEl.textContent = '请填写完整信息';
        msgEl.className = 'message message-error';
        msgEl.style.display = 'block';
        return;
      }
      try {
        let res;
        if (id) {
          // 编辑
          res = await fetch(`/api/auth/groups/${id}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name, permissions, current_password })
          });
        } else {
          // 创建
          res = await fetch('/api/auth/groups', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name, permissions })
          });
        }
        if (!res.ok) throw new Error('操作失败');
        msgEl.textContent = '保存成功';
        msgEl.className = 'message message-success';
        msgEl.style.display = 'block';
        setTimeout(() => {
          closeGroupModal();
          loadAllGroups();
        }, 1200);
      } catch (e) {
        msgEl.textContent = '操作失败';
        msgEl.className = 'message message-error';
        msgEl.style.display = 'block';
      }
    }
    async function deleteGroup(id) {
      if (!confirm('确定要删除该用户组吗？')) return;
      try {
        const res = await fetch(`/api/auth/groups/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('删除失败');
        showGroupsMessage('用户组已删除', true);
        loadAllGroups();
      } catch (e) {
        showGroupsMessage('删除失败', false);
      }
    }
    // 页面加载时加载用户组
    document.addEventListener('DOMContentLoaded', loadAllGroups);
    
    // 绑定搜索和过滤事件
    document.getElementById('search-name').addEventListener('input', () => renderUsersTable(allUsers));
    document.getElementById('search-phira').addEventListener('input', () => renderUsersTable(allUsers));
    document.getElementById('filter-admin').addEventListener('change', () => renderUsersTable(allUsers));
    document.getElementById('filter-dev').addEventListener('change', () => renderUsersTable(allUsers));
    
    // 全选/取消全选
    document.getElementById('select-all').addEventListener('change', function() {
      document.querySelectorAll('.user-select').forEach(checkbox => {
        checkbox.checked = this.checked;
      });
    });
    
    // 复用account.html中的函数
    function updateUserDisplay() {
      if (currentUser) {
        document.getElementById('username-display').textContent = currentUser.username;
        document.getElementById('user-avatar').src = currentUser.phira_avatar || 'https://phira.moe/assets/user-6212ee95.png';
        document.getElementById('dropdown-username').textContent = currentUser.username;
        const phiraLink = document.getElementById('phira-profile-link');
        if (phiraLink && currentUser.phira_id) {
          phiraLink.href = `https://phira.moe/user/${currentUser.phira_id}`;
        }
      }
    }
    
    function toggleDropdown() {
      const dropdown = document.getElementById('user-dropdown');
      if (dropdown) {
        dropdown.classList.toggle('show');
      }
    }

    // 关闭管理员密码模态框并清理状态
    function closeAdminPasswordModal() {
      const modal = document.getElementById('admin-password-modal');
      const input = document.getElementById('admin-password-input');
      const msg = document.getElementById('admin-password-message');
      if (modal) modal.style.display = 'none';
      if (input) input.value = '';
      if (msg) {
        msg.style.display = 'none';
        msg.textContent = '';
      }
    }

    // 验证管理员密码：使用当前用户用户名调用登录接口进行密码校验，校验成功后保存 adminPassword 并触发后续回调
    async function verifyAdminPassword() {
      const input = document.getElementById('admin-password-input');
      const msg = document.getElementById('admin-password-message');
      if (!input || !msg) return;
      msg.style.display = 'none';
      const password = input.value || '';
      if (!password) {
        msg.textContent = '请输入管理员密码';
        msg.className = 'message message-error';
        msg.style.display = 'block';
        return;
      }
      if (!currentUser || !currentUser.username) {
        msg.textContent = '未检测到当前用户，请先登录';
        msg.className = 'message message-error';
        msg.style.display = 'block';
        return;
      }
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ username: currentUser.username, password, remember: false })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error((data && data.message) || '验证失败');
        }
        // 验证成功，保存密码并关闭模态框，然后触发一轮回调（如果有）
        adminPassword = password;
        msg.textContent = '验证成功';
        msg.className = 'message message-success';
        msg.style.display = 'block';
        setTimeout(() => {
          closeAdminPasswordModal();
          if (window._afterAdminVerified) {
            try { window._afterAdminVerified(); } catch (e) { /* ignore */ }
            delete window._afterAdminVerified;
          }
        }, 600);
      } catch (e) {
        msg.textContent = e.message || '验证失败';
        msg.className = 'message message-error';
        msg.style.display = 'block';
      }
    }
    
    function logout() {
      localStorage.removeItem('user');
      window.location.href = 'index.html';
    }