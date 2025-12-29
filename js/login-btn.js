    // 更新用户显示区域
    function updateUserDisplay() {
      const loginButton = document.getElementById('login-button');
      const avatarContainer = document.getElementById('avatar-container');
      
      if (currentUser) {
        // 隐藏登录按钮
        loginButton.style.display = 'none';
        
        // 显示头像容器
        avatarContainer.style.display = 'flex';
        
        // 更新用户名和头像
        document.getElementById('username-display').textContent = currentUser.username;
        document.getElementById('user-avatar').src = currentUser.phira_avatar || DEFAULT_AVATAR;
        document.getElementById('dropdown-username').textContent = currentUser.username;
        
        // 更新Phira账户链接
        const phiraLink = document.getElementById('phira-profile-link');
        if (phiraLink && currentUser.phira_id) {
          phiraLink.href = `https://phira.moe/user/${currentUser.phira_id}`;
        }
      } else {
        // 显示登录按钮
        loginButton.style.display = 'flex';
        
        // 隐藏头像容器
        avatarContainer.style.display = 'none';
      }
    }

    // 切换下拉菜单显示状态
    function toggleDropdown() {
      const dropdown = document.getElementById('user-dropdown');
      if (dropdown) {
        dropdown.classList.toggle('show');
      }
    }

    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('user-dropdown');
      const userInfo = document.querySelector('.user-info');
      if (dropdown && dropdown.classList.contains('show') && 
          !e.target.closest('.user-info') && 
          !e.target.closest('.dropdown-content')) {
        dropdown.classList.remove('show');
      }
    });

    // 退出登录
    async function logout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        updateUserDisplay();
        // 关闭下拉菜单
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) dropdown.classList.remove('show');
      } catch (err) {
        console.error('登出失败:', err);
      }
    }