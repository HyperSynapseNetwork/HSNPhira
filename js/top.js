    // 默认头像URL
    const DEFAULT_AVATAR = 'https://phira.moe/assets/user-6212ee95.png';
    const CHART_CACHE = new Map();
    const API_BASE_URL = 'https://phira.htadiy.cc/topchart/hot_rank';
    
    // 排行榜数据缓存
    let chartDataCache = {
      hour: null,
      day: null,
      week: null,
      month: null
    };
    
    let currentUser = null;
    let authMode = 'login';
    let autoRefreshInterval;
    
    // 热门谱面相关状态
    let currentTimeRange = 'hour';
    let currentPage = 1;
    let perPage = 10;
    let totalResults = 0;
    let lastChartListUpdate = null;
    let lastRecordUpdate = null;
    let usingCachedData = false;

    // 页面加载时检查登录状态并初始化
    document.addEventListener('DOMContentLoaded', async () => {
      // 尝试获取当前会话
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          currentUser = await response.json();
          updateUserDisplay();
        }
      } catch (error) {
        console.error('检查会话失败:', error);
      }

      // 首次检查服务器状态并加载热门谱面数据
      await checkServerStatus();
      await loadHotCharts();

      // 等待资源完全准备好后再隐藏加载器
      await waitForAppReady();

      // 设置每30秒自动刷新
      autoRefreshInterval = setInterval(async () => {
        await checkServerStatus();
        await loadHotCharts();
      }, 30000);

      // 添加时间范围按钮事件监听
      document.querySelectorAll('.time-range-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const range = btn.dataset.range;
          if (range !== currentTimeRange) {
            // 更新活动按钮
            document.querySelectorAll('.time-range-btn').forEach(b => {
              b.classList.remove('active');
            });
            btn.classList.add('active');
            
            // 更新当前时间范围并重新加载数据
            currentTimeRange = range;
            currentPage = 1;
            loadHotCharts();
          }
        });
      });
      
      // 添加分页按钮事件监听
      document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          loadHotCharts();
        }
      });
      
      document.getElementById('next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(totalResults / perPage);
        if (currentPage < totalPages) {
          currentPage++;
          loadHotCharts();
        }
      });
    });

    // 检查服务器状态
    async function checkServerStatus() {
      const status = document.getElementById("status");
      try {
        const res = await fetch("/api/rooms/info?_=" + Date.now(), { method: "GET", cache: "no-store" });
        if (res.ok) {
          status.textContent = "服务器状态：在线 :)  加入我们的QQ群：1049578201";
          status.classList.add("online");
          status.classList.remove("offline");
          status.classList.remove("cached");
        } else {
          throw new Error("无返回");
        }
      } catch (err) {
        status.textContent = "服务器状态：离线 :(  加入我们的QQ群：1049578201";
        status.classList.add("offline");
        status.classList.remove("online");
        status.classList.remove("cached");
      }
    }

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
    
    // 获取谱面信息
    async function getChartInfo(chartId) {
      if (CHART_CACHE.has(chartId)) {
        return CHART_CACHE.get(chartId);
      }
      
      try {
        const res = await fetch(`https://phira.5wyxi.com/chart/${chartId}`);
        if (!res.ok) return null;
        const chartData = await res.json();
        CHART_CACHE.set(chartId, chartData);
        return chartData;
      } catch (err) {
        console.error('获取谱面信息错误:', err);
        return null;
      }
    }
    
    // 加载热门谱面数据
    async function loadHotCharts() {
      try {
        const url = `${API_BASE_URL}/${currentTimeRange}?page=${currentPage}&per_page=${perPage}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('获取热门谱面失败');
        const data = await res.json();
        
        // 检查API返回的数据是否为空
        if (data.results && data.results.length > 0) {
          // 数据有效，更新全局状态
          lastChartListUpdate = data.last_chart_list_update;
          lastRecordUpdate = data.last_record_update;
          totalResults = data.total_results;
          currentPage = data.page;
          perPage = data.per_page;
          
          // 更新缓存
          chartDataCache[currentTimeRange] = {
            data: data,
            timestamp: new Date().toISOString()
          };
          
          // 更新状态显示
          const updateTime = new Date(lastRecordUpdate)
            .toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' });
          status.textContent = `服务器状态：在线 :)  数据更新时间：${updateTime}  加入我们的QQ群：1049578201`;
          status.classList.add("online");
          status.classList.remove("offline");
          status.classList.remove("cached");
          
          // 隐藏缓存提示
          document.getElementById('cache-info').style.display = 'none';
          usingCachedData = false;
          
          // 渲染表格
          renderChartsTable(data.results);
        } else {
          // API返回了空数据，尝试使用缓存数据
          useCachedData();
        }
      } catch (err) {
        console.error('加载热门谱面错误:', err);
        // 尝试使用缓存数据
        useCachedData();
      }
    }
    
    // 使用缓存数据
    function useCachedData() {
      if (chartDataCache[currentTimeRange] && chartDataCache[currentTimeRange].data) {
        const cachedData = chartDataCache[currentTimeRange].data;
        const cacheTime = new Date(chartDataCache[currentTimeRange].timestamp).toLocaleTimeString();
        
        // 更新状态显示为缓存数据
        const status = document.getElementById("status");
        status.textContent = "服务器状态：在线 :) 加入我们的QQ群：1049578201";
        status.classList.add("cached");
        status.classList.remove("online");
        status.classList.remove("offline");
        
        // 显示缓存提示
        const cacheInfo = document.getElementById('cache-info');
        cacheInfo.textContent = `数据更新时间：${cacheTime}`;
        cacheInfo.style.display = 'block';
        
        // 渲染缓存数据
        renderChartsTable(cachedData.results);
        usingCachedData = true;
      } else {
        // 没有缓存数据时显示错误
        const status = document.getElementById("status");
        status.textContent = "服务器状态：离线 :(  加入我们的QQ群：1049578201";
        status.classList.add("offline");
        status.classList.remove("online");
        status.classList.remove("cached");
        
        const tbody = document.querySelector("#charts-table tbody");
        tbody.innerHTML = "<tr><td colspan='6'>加载失败，请稍后重试</td></tr>";
      }
    }
    
    // 渲染谱面表格
    async function renderChartsTable(results) {
      const tbody = document.querySelector("#charts-table tbody");
      if (!Array.isArray(results) || results.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6'>暂时无数据</td></tr>";
        return;
      }

      // 清除现有内容
      tbody.innerHTML = "";

      // 处理每个谱面
      for (let i = 0; i < results.length; i++) {
        const chart = results[i];
        const rank = (currentPage - 1) * perPage + i + 1;
        
        // 获取谱面信息
        const chartInfo = await getChartInfo(chart.chart_id);
        
        // 构建表格行
        const tr = document.createElement("tr");
        
        // 名次列
        const rankTd = document.createElement("td");
        rankTd.textContent = rank;
        tr.appendChild(rankTd);
        
        // 谱面名称列
        const nameTd = document.createElement("td");
        if (chartInfo && chartInfo.name) {
          const nameBtn = document.createElement("a");
          nameBtn.href = `https://phira.moe/chart/${chart.chart_id}`;
          nameBtn.target = "_blank";
          nameBtn.className = "chart-name-btn";
          nameBtn.textContent = chartInfo.name;
          nameTd.appendChild(nameBtn);
        } else {
          nameTd.textContent = `ID: ${chart.chart_id}`;
        }
        tr.appendChild(nameTd);
        
        // 谱面ID列
        const idTd = document.createElement("td");
        const idSpan = document.createElement("span");
        idSpan.textContent = chart.chart_id;
        idSpan.style.marginRight = "0.5rem";
        idSpan.style.fontFamily = "monospace";
        idSpan.style.fontWeight = "bold";
        idSpan.style.color = "#61E8EA";
        
        const copyBtn = document.createElement("button");
        copyBtn.className = "chart-btn";
        copyBtn.textContent = "复制";
        copyBtn.onclick = () => copyChartId(chart.chart_id);
        
        idTd.appendChild(idSpan);
        idTd.appendChild(copyBtn);
        tr.appendChild(idTd);
        
        // 游玩人数列
        const playersTd = document.createElement("td");
        playersTd.textContent = chart.increase;
        tr.appendChild(playersTd);
        
        // 曲绘列 - 修复变量名错误
        const coverTd = document.createElement("td");
        if (chartInfo && chartInfo.illustration) {
          const coverBtn = document.createElement("button"); // 修复变量名
          coverBtn.className = "chart-btn";
          coverBtn.textContent = "查看";
          coverBtn.onclick = () => showLightbox(chartInfo.illustration);
          coverTd.appendChild(coverBtn);
        } else {
          coverTd.textContent = "无封面";
        }
        tr.appendChild(coverTd);
        
        // 下载列
        const downloadTd = document.createElement("td");
        if (chartInfo && chartInfo.file) {
          const downloadLink = document.createElement("a");
          downloadLink.href = chartInfo.file;
          downloadLink.download = `chart_${chart.chart_id}.zip`;
          const downloadBtn = document.createElement("button");
          downloadBtn.className = "dl-btn";
          downloadBtn.textContent = "下载";
          downloadLink.appendChild(downloadBtn);
          downloadTd.appendChild(downloadLink);
        } else {
          downloadTd.textContent = "无文件";
        }
        tr.appendChild(downloadTd);
        
        tbody.appendChild(tr);
      }

      // 更新分页控件
      updatePaginationControls();
    }
    
    // 复制谱面ID
    function copyChartId(chartId) {
      navigator.clipboard.writeText(chartId)
        .then(() => {
          // 显示复制成功提示
          const notification = document.getElementById('copy-notification');
          notification.classList.add('show');
          setTimeout(() => {
            notification.classList.remove('show');
          }, 2000);
        })
        .catch(err => {
          console.error('复制失败:', err);
          alert('复制失败，请手动复制谱面ID');
        });
    }
    
    // 更新分页控件状态
    function updatePaginationControls() {
      const prevBtn = document.getElementById('prev-page');
      const nextBtn = document.getElementById('next-page');
      const pageInfo = document.getElementById('page-info');
      
      const totalPages = Math.ceil(totalResults / perPage);
      
      // 更新页面信息
      pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;
      
      // 更新按钮状态
      prevBtn.disabled = currentPage <= 1;
      nextBtn.disabled = currentPage >= totalPages;
    }

    // 等待页面资源加载完成的通用函数
    async function waitForAppReady() {
      // 等待表格加载完成
      const maxWait = 3000; // 最长等待时间
      const start = Date.now();
      const tbody = document.querySelector('#charts-table tbody');
      while (Date.now() - start < maxWait) {
        if (tbody && tbody.innerHTML && !tbody.innerHTML.includes('加载中') && !tbody.innerHTML.includes('加')) break;
        await new Promise(r => setTimeout(r, 80));
      }

      // 隐藏加载器并显示主内容
      const loader = document.getElementById('page-loader');
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        mainContent.style.opacity = 1;
      }
      if (loader) {
        setTimeout(() => loader.classList.add('hide'), 120);
      }
    }
    
    function showLightbox(src) {
      const lb = document.getElementById("lightbox");
      document.getElementById("lightbox-img").src = src;
      lb.style.display = "flex";
      requestAnimationFrame(() => lb.classList.add("active"));
    }
    
    function hideLightbox() {
      const lb = document.getElementById("lightbox");
      lb.classList.remove("active");
      setTimeout(() => {
        lb.style.display = "none";
        document.getElementById("lightbox-img").src = "";
      }, 300);
    }
    
    function closeModal() {
      document.getElementById("user-modal").style.display = "none";
    }
    
    function openAuth() {
      document.getElementById('auth-modal').style.display = 'flex';
      document.getElementById('auth-msg').textContent = '';
      updateAuthUI();
    }
    
    function closeAuth() {
      document.getElementById('auth-modal').style.display = 'none';
    }
    
    function toggleAuthMode() {
      authMode = authMode === 'login' ? 'register' : 'login';
      updateAuthUI();
      
      // 显示/隐藏用户协议复选框
      const agreementContainer = document.getElementById('agreement-container');
      agreementContainer.style.display = authMode === 'register' ? 'flex' : 'none';
    }
    
    function updateAuthUI() {
      var title = document.getElementById('auth-title');
      var phiraid = document.getElementById('auth-phiraid');
      if (authMode === 'login') {
        title.textContent = '用户登录';
        phiraid.classList.add('collapsed');
      }
      else {
        title.textContent = '用户注册';
        phiraid.classList.remove('collapsed');
      }
    }
    
    async function submitAuth() {
      const username = document.getElementById('auth-name').value;
      const password = document.getElementById('auth-password').value;
      const phira_id = document.getElementById('auth-phiraid').value;
      const remember = document.getElementById('remember-me').checked;
      const agreeTerms = authMode === 'register' ? document.getElementById('agree-terms').checked : true;
      const msg = document.getElementById('auth-msg');
      msg.textContent = '处理中...';
    
      try {
        // 注册时需要确认用户协议
        if (authMode === 'register' && !agreeTerms) {
          msg.textContent = '请同意用户协议';
          return;
        }
        
        const endpoint = authMode === 'login' 
          ? '/api/auth/login'
          : '/api/auth/users';
          
        const payload = authMode === 'login'
          ? { username, password, remember: remember }
          : { username, password, phira_id };
        
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          msg.textContent = errorData.message || '操作失败';
          return;
        }
        
        // 登录成功后获取用户信息
        if (authMode === 'login') {
          const userRes = await fetch('/api/auth/me');
          if (!userRes.ok) {
            msg.textContent = '获取用户信息失败';
            return;
          }
          currentUser = await userRes.json();
          updateUserDisplay();
        }
        
        msg.textContent = authMode === 'login' ? '登录成功！' : '注册成功！';
        setTimeout(() => {
          closeAuth();
          if (authMode === 'register') {
            authMode = 'login';
            updateAuthUI();
          }
          msg.textContent = '';
        }, 1000);
      } catch (e) {
        msg.textContent = '网络错误';
        console.error('认证错误:', e);
      }
    }