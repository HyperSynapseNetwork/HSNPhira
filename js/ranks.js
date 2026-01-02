         // 默认头像URL
         const DEFAULT_AVATAR = 'https://phira.moe/assets/user-6212ee95.png';
         const USER_CACHE = new Map();
         
         let currentUser = null;
         let authMode = 'login';
         let autoRefreshInterval;
         let isHoveringTable = false;
         let lastMousePosition = { x: 0, y: 0 };

         // 排行榜相关变量
         let currentPage = 1;
         const pageSize = 10;
         let totalUsers = 0;
         let totalPlaytime = 0;
         let fullLeaderboardData = [];
         let filteredLeaderboardData = [];
         let isSearching = false;
         let lastSearchQuery = ''; // 保存上次搜索条件

         // 分段加载与并发控制
         let leaderboardChunkSize = 50; // 每次请求多少条排行榜条目
         let leaderboardOffset = 0; // 下一次应该请求的偏移量
         let hasMoreLeaderboardData = true; // 是否还有未加载的数据
         let chunkFetchConcurrency = 3; // 同时发起多少个排行榜段请求
         let userFetchConcurrency = 8; // 获取用户信息时并发数
         let prefetching = false; // 后台预取进行中标志

         // 页面加载时检查登录状态并初始化
         document.addEventListener('DOMContentLoaded', async () => {
              // 扩大表格倾斜范围：全局鼠标不再驱动整个页面，而使用 overlay 驱动表格倾斜
              const leaderboardTable = document.getElementById('leaderboard-table');
              if (leaderboardTable) {
                   // 保持表格初始微倾斜
                   leaderboardTable.style.transform = 'translateZ(20px) rotateX(0deg) rotateY(0deg)';
              }

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

              // 首次检查服务器状态并加载排行榜数据
              await checkServerStatus();
              await loadLeaderboard();

              // 等待资源完全准备好后再隐藏加载器
              await waitForAppReady();

              // 安装倾斜 overlay（基于表格的实时几何中心，面积为两倍）
              installTableTiltOverlay();

              // 设置每秒自动刷新
              autoRefreshInterval = setInterval(async () => {
                   // 如果正在搜索，不自动刷新
                   if (isSearching) return;
                   
                   await checkServerStatus();
                   await loadLeaderboard();
              }, 1000);

              // 翻页按钮事件监听
              document.getElementById('prev-page').addEventListener('click', () => {
                   if (currentPage > 1) {
                        currentPage--;
                        renderLeaderboardPage();
                   }
              });

              document.getElementById('next-page').addEventListener('click', () => {
                   const maxPage = Math.ceil(totalUsers / pageSize);
                   if (currentPage < maxPage) {
                        currentPage++;
                        renderLeaderboardPage();
                   }
              });

              // 搜索框输入事件监听
              const searchInput = document.getElementById('search-input');
              searchInput.addEventListener('input', debounce(() => {
                   const query = searchInput.value.trim();
                   lastSearchQuery = query;
                   performSearch(query);
              }, 300));

              // 兼容性：如果自定义的 .glass-checkbox 无法响应 click，使用事件委托做一次切换
              document.addEventListener('click', (e) => {
                   const box = e.target.closest && e.target.closest('.glass-checkbox');
                   if (!box) return;
                   const input = box.querySelector('input[type="checkbox"]');
                   if (!input) return;
                   // 如果点击目标就是 input ，让浏览器正常处理；否则手动切换并派发 change
                   if (e.target === input) return;
                   input.checked = !input.checked;
                   input.dispatchEvent(new Event('change', { bubbles: true }));
              });

              // 当 checkbox 状态变化时，给容器添加/移除 .checked 以显示视觉打勾
              document.addEventListener('change', (e) => {
                   const input = e.target;
                   if (!input || input.type !== 'checkbox') return;
                   const box = input.closest && input.closest('.glass-checkbox');
                   if (!box) return;
                   if (input.checked) box.classList.add('checked'); else box.classList.remove('checked');
              });
         });

         // 防抖函数
         function debounce(func, wait) {
              let timeout;
              return function executedFunction(...args) {
                   const later = () => {
                        clearTimeout(timeout);
                        func(...args);
                   };
                   clearTimeout(timeout);
                   timeout = setTimeout(later, wait);
              };
         }

         // 执行搜索
         function performSearch(query) {
              if (!query) {
                   isSearching = false;
                   currentPage = 1;
                   renderLeaderboardPage();
                   return;
              }
              
              isSearching = true;
              
              // 同时搜索ID和用户名
              filteredLeaderboardData = fullLeaderboardData.filter(user => {
                   // ID精确匹配
                   if (user.user_id.toString() === query) {
                        return true;
                   }
                   
                   // 用户名模糊匹配（如果用户名已缓存）
                   if (USER_CACHE.has(user.user_id)) {
                        const userInfo = USER_CACHE.get(user.user_id);
                        if (userInfo && userInfo.name && userInfo.name.toLowerCase().includes(query.toLowerCase())) {
                             return true;
                        }
                   }
                   
                   return false;
              });
              
              currentPage = 1;
              renderLeaderboardPage();
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

         // 获取用户信息
         async function getUserInfo(userId) {
              if (USER_CACHE.has(userId)) {
                   return USER_CACHE.get(userId);
              }
              
              try {
                   const res = await fetch(`https://phira.5wyxi.com/user/${userId}`);
                   if (!res.ok) return null;
                   const userData = await res.json();
                   USER_CACHE.set(userId, userData);
                   return userData;
              } catch (err) {
                   console.error('获取用户信息错误:', err);
                   return null;
              }
         }
         
         // 加载排行榜数据（分段：先加载首段并立即呈现，后台并发预取剩余）
         async function loadLeaderboard() {
              try {
                   // 首次只请求首段数据以尽快展示界面
                   const initialLimit = leaderboardChunkSize;
                   const { chunk, total } = await fetchLeaderboardChunk(0, initialLimit);

                   fullLeaderboardData = Array.isArray(chunk) ? chunk : [];
                   totalUsers = total || fullLeaderboardData.length;
                   leaderboardOffset = fullLeaderboardData.length;
                   hasMoreLeaderboardData = fullLeaderboardData.length < totalUsers;

                   // 计算已加载部分的总游玩时间，并展示
                   totalPlaytime = fullLeaderboardData.reduce((sum, user) => sum + user.total_playtime, 0);
                   updateTotalPlaytimeDisplay();

                   // 立即缓存首段的用户名（并发）
                   cacheAllUsernames(fullLeaderboardData.map(u => u.user_id)).catch(e => console.warn(e));

                   // 如果有搜索条件，先在已加载数据中搜索（后台会继续加载更多）
                   const searchInput = document.getElementById('search-input');
                   if (searchInput.value.trim()) {
                        performSearch(searchInput.value.trim());
                   } else {
                        renderLeaderboardPage();
                   }

                   // 更新加载进度显示
                   updateLoadProgress();

                   // 异步在后台预取剩余段，不阻塞主线程
                   prefetchRemainingLeaderboard().catch(e => console.warn('预取失败', e));

                   // 更新服务器状态
                   const status = document.getElementById("status");
                   status.textContent = "服务器状态：在线 :)   ";
                   status.classList.add("online");
                   status.classList.remove("offline");
              } catch (err) {
                   console.error('加载排行榜信息错误:', err);
                   const status = document.getElementById("status");
                   status.textContent = "服务器状态：离线 :(   ";
                   status.classList.add("offline");
                   status.classList.remove("online");
                   
                   const tbody = document.querySelector("#leaderboard-table tbody");
                   tbody.innerHTML = "<tr><td colspan='3'>加载失败，请刷新页面重试</td></tr>";
              }
         }
         
// 缓存所有用户名（改进：支持传入部分ID并使用并发池）
         async function cacheAllUsernames(userIds) {
              // 如果没有传入 userIds，默认使用当前已知的排行榜数据
              const idsToCheck = Array.isArray(userIds)
                   ? userIds
                   : fullLeaderboardData.map(u => u.user_id);

              const uncachedUserIds = idsToCheck.filter(id => !USER_CACHE.has(id));
              if (uncachedUserIds.length === 0) return;

              console.log(`正在获取 ${uncachedUserIds.length} 个用户信息（并发 ${userFetchConcurrency}）...`);

              const concurrency = userFetchConcurrency;
              let index = 0;
              while (index < uncachedUserIds.length) {
                   const batch = uncachedUserIds.slice(index, index + concurrency);
                   await Promise.allSettled(batch.map(uid => getUserInfo(uid)));
                   index += concurrency;
                   // 为了不对外部服务造成短时间内太多压力，短延迟一小段（可配置）
                   await new Promise(resolve => setTimeout(resolve, 30));
              }
         }
         
// 渲染排行榜当前页（快速首屏：立即渲染占位符，用户名异步填充）
         function renderLeaderboardPage() {
              const tbody = document.querySelector("#leaderboard-table tbody");
              const displayData = isSearching ? filteredLeaderboardData : fullLeaderboardData;

              if (!Array.isArray(displayData) || displayData.length === 0) {
                   if (isSearching) {
                        tbody.innerHTML = "<tr><td colspan='3'>没有找到匹配的用户</td></tr>";
                   } else {
                        tbody.innerHTML = "<tr><td colspan='3'>暂无数据</td></tr>";
                   }
                   updatePaginationControls(0);
                   return;
              }

              // 计算当前页数据范围
              const startIndex = (currentPage - 1) * pageSize;
              // 如果用户请求的页数据尚未加载完，则在后台尽量触发更多加载
              const endIndex = Math.min(startIndex + pageSize, displayData.length);
              const pageData = displayData.slice(startIndex, endIndex);

              // 清空并渲染占位符（快速呈现）
              tbody.innerHTML = "";
              for (let i = 0; i < pageData.length; i++) {
                   const user = pageData[i];
                   const rank = isSearching ?
                        fullLeaderboardData.findIndex(u => u.user_id === user.user_id) + 1 :
                        startIndex + i + 1;

                   const tr = document.createElement("tr");
                   // 先渲染用户名占位符
                   tr.innerHTML = `
                        <td>${rank}</td>
                        <td><a href="https://phira.moe/user/${user.user_id}" target="_blank"><button class="chart-btn">加载中...</button></a></td>
                        <td>${formatPlaytime(user.total_playtime)}</td>
                   `;
                   tbody.appendChild(tr);

                   // 异步获取用户名并替换占位符（不阻塞其它行渲染）
                   (function(nameCell, uid){
                        getUserInfo(uid).then(userInfo => {
                             const name = userInfo && userInfo.name ? userInfo.name : `用户${uid}`;
                             nameCell.innerHTML = `<a href=\"https://phira.moe/user/${uid}\" target=\"_blank\"><button class=\"chart-btn\">${escapeHtml(name)}</button></a>`;
                        }).catch(() => {
                             nameCell.innerHTML = `<a href=\"https://phira.moe/user/${uid}\" target=\"_blank\"><button class=\"chart-btn\">用户${uid}</button></a>`;
                        });
                   })(tr.cells[1], user.user_id);
              }

              // 若当前页超出了已加载数据范围，触发后台预取更多
              const neededUntil = endIndex;
              if (neededUntil > fullLeaderboardData.length - 3 && hasMoreLeaderboardData) {
                   // 触发预取以保证用户翻页不会等待太久
                   prefetchRemainingLeaderboard().catch(e => console.warn('prefetch during render failed', e));
              }

              // 更新翻页控件状态
              const knownLength = totalUsers || fullLeaderboardData.length;
              updatePaginationControls(knownLength);
         }
         
         // 更新翻页控件状态
         function updatePaginationControls(dataLength) {
              const maxPage = Math.ceil(dataLength / pageSize);
              document.getElementById('page-info').textContent = `第 ${currentPage} 页 / 共 ${maxPage} 页`;
              document.getElementById('prev-page').disabled = currentPage <= 1;
              document.getElementById('next-page').disabled = currentPage >= maxPage;
         }
         
         // 格式化游玩时间
         function formatPlaytime(seconds) {
              const days = Math.floor(seconds / (3600 * 24));
              const hours = Math.floor((seconds % (3600 * 24)) / 3600);
              const minutes = Math.floor((seconds % 3600) / 60);
              const secs = seconds % 60;
              
              let result = '';
              if (days > 0) result += `${days}天 `;
              if (hours > 0) result += `${hours}小时 `;
              if (minutes > 0) result += `${minutes}分 `;
              result += `${secs}秒`;
              
              return result;
         }

         // 等待页面资源加载完成的通用函数
         async function waitForAppReady() {
              // 等待排行榜加载完成（确保 tbody 不再显示加载中）并等待文档内图片加载
              const maxWait = 3000; // 最长等待时间
              const start = Date.now();
              const tbody = document.querySelector('#leaderboard-table tbody');
              while (Date.now() - start < maxWait) {
                   if (tbody && tbody.innerHTML && !tbody.innerHTML.includes('加载中') && !tbody.innerHTML.includes('加')) break;
                   await new Promise(r => setTimeout(r, 80));
              }

              // 等待页面内图片加载完
              const imgs = Array.from(document.images);
              await Promise.all(imgs.map(img => {
                   if (img.complete) return Promise.resolve();
                   return new Promise(res => { img.addEventListener('load', res); img.addEventListener('error', res); });
              }).slice(0));

              // 隐藏加载器并显示主内容
              const loader = document.getElementById('page-loader');
              const mainContent = document.getElementById('main-content');
              // 强制一次重绘并短延迟，避免毛玻璃效果在样式应用前闪烁
              if (mainContent) {
                   // 触发回流
                   void mainContent.offsetHeight;
                   mainContent.style.opacity = 1;
              }
              if (loader) {
                   // 给主内容一点时间应用 backdrop-filter 等样式
                   setTimeout(() => loader.classList.add('hide'), 120);
              }
         }

         // 安装表格倾斜触发 overlay：面积为表格面积两倍，中心一致
         function installTableTiltOverlay() {
              const table = document.getElementById('leaderboard-table');
              if (!table) return;
              // remove existing if any
              const existing = document.getElementById('table-tilt-overlay');
              if (existing) existing.remove();

              const rect = table.getBoundingClientRect();
              const overlay = document.createElement('div');
              overlay.id = 'table-tilt-overlay';
              // 计算面积扩大时的边长扩展（保留中心）——稍微放大 overlay 以便更容易触发，scale ~1.6
              const scale = 1.6;
              const w = rect.width * scale;
              const h = rect.height * scale;
              overlay.style.width = w + 'px';
              overlay.style.height = h + 'px';
              overlay.style.left = (rect.left + (rect.width - w) / 2) + 'px';
              overlay.style.top = (rect.top + (rect.height - h) / 2) + 'px';
              overlay.style.position = 'fixed';
              // 不阻塞下面元素的点击：让 overlay 对指针事件透明，使用 window 的 mousemove 代替
              overlay.style.pointerEvents = 'none';
              overlay.style.background = 'transparent';
              document.body.appendChild(overlay);

              // 鼠标在 overlay 上时，表格倾斜，角度与鼠标到几何中心距离成正比
              // 使用 window mousemove 以允许点击穿透 overlay。
              // 若之前已安装 overlay，移除旧的全局监听
              if (existing && existing._handler) {
                   window.removeEventListener('mousemove', existing._handler);
              }

              let isHovering = false;
              function onGlobalMouseMove(e) {
                   // 当前位置是否在 overlay 的几何范围内
                   const orect = overlay.getBoundingClientRect();
                   const inside = e.clientX >= orect.left && e.clientX <= orect.right && e.clientY >= orect.top && e.clientY <= orect.bottom;
                   if (!inside) {
                        if (isHovering) {
                             isHovering = false;
                             table.classList.remove('tilting');
                             table.style.transition = 'transform 0.6s cubic-bezier(.4,2,.3,1)';
                             table.style.transform = 'translateZ(20px) rotateX(0deg) rotateY(0deg)';
                        }
                        return;
                   }
                   isHovering = true;
                   const currentRect = table.getBoundingClientRect();
                   const centerX = currentRect.left + currentRect.width / 2;
                   const centerY = currentRect.top + currentRect.height / 2;
                   const dx = e.clientX - centerX;
                   const dy = e.clientY - centerY;
                   const maxDist = Math.hypot(currentRect.width/2, currentRect.height/2);
                   const dist = Math.hypot(dx, dy);
                   const ratio = Math.min(1, dist / maxDist);
                   const maxAngle = 8;
                   const angle = ratio * maxAngle;
                   const rotateY = (dx / maxDist) * angle;
                   const rotateX = -(dy / maxDist) * angle;
                   table.classList.add('tilting');
                   table.style.transform = `translateZ(20px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
              }
              window.addEventListener('mousemove', onGlobalMouseMove);
              // 保存 handler 以便重新安装前移除
              overlay._handler = onGlobalMouseMove;

              // 若窗口变化，重新计算 overlay
              window.addEventListener('resize', () => {
                   const r = table.getBoundingClientRect();
                   const w2 = r.width * scale;
                   const h2 = r.height * scale;
                   overlay.style.width = w2 + 'px';
                   overlay.style.height = h2 + 'px';
                   overlay.style.left = (r.left + (r.width - w2) / 2) + 'px';
                   overlay.style.top = (r.top + (r.height - h2) / 2) + 'px';
              });
              // 页面滚动时也需要重新计算 overlay 位置
              window.addEventListener('scroll', () => {
                   const r = table.getBoundingClientRect();
                   const w2 = r.width * scale;
                   const h2 = r.height * scale;
                   overlay.style.width = w2 + 'px';
                   overlay.style.height = h2 + 'px';
                   overlay.style.left = (r.left + (r.width - w2) / 2) + 'px';
                   overlay.style.top = (r.top + (r.height - h2) / 2) + 'px';
              }, { passive: true });
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
              const w = document.getElementById('user-window');
              if (w) w.close();
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
              agreementContainer.style.display = authMode === 'register' ? 'block' : 'none';
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

         // 尝试按偏移量/长度请求排行榜段（若后端不支持 offset/limit，则会退回到全量返回）
         async function fetchLeaderboardChunk(offset, limit) {
              try {
                   const res = await fetch(`/rankapi/playtime_leaderboard?offset=${offset}&limit=${limit}&_=${Date.now()}`, { method: 'GET', cache: 'no-store' });
                   if (!res.ok) throw new Error('请求失败');
                   const data = await res.json();
                   if (!data.success) throw new Error('API返回失败');
                   return { chunk: data.data || [], total: data.total_users };
              } catch (err) {
                   console.warn('分段请求失败，尝试退回全量请求', err);
                   // 退回到全量请求以保证兼容性
                   const res = await fetch('/rankapi/playtime_leaderboard');
                   if (!res.ok) throw err;
                   const data = await res.json();
                   if (!data.success) throw new Error('API返回失败');
                   return { chunk: data.data || [], total: data.total_users };
              }
         }

         // 后台预取剩余的排行榜段，使用并发池
         async function prefetchRemainingLeaderboard() {
              if (prefetching) return;
              if (!hasMoreLeaderboardData) return;
              prefetching = true;
              try {
                   const total = totalUsers || 0;
                   const limit = leaderboardChunkSize;
                   let offset = leaderboardOffset;

                   const workers = [];
                   while (offset < total) {
                        const thisOffset = offset;
                        offset += limit;
                        workers.push((async () => {
                             try {
                                  const { chunk } = await fetchLeaderboardChunk(thisOffset, limit);
                                  if (Array.isArray(chunk) && chunk.length) {
                                       // append
                                       fullLeaderboardData = fullLeaderboardData.concat(chunk);
                                       leaderboardOffset = fullLeaderboardData.length;
                                       // 更新总游玩时间（增量）
                                       totalPlaytime += chunk.reduce((s, u) => s + u.total_playtime, 0);
                                       updateTotalPlaytimeDisplay();
                                       // 并发缓存用户信息
                                       cacheAllUsernames(chunk.map(u => u.user_id)).catch(e => console.warn(e));
                                       // 更新加载进度
                                       updateLoadProgress();
                                       // 若用户当前页落在新数据内，尝试渲染最新
                                       renderLeaderboardPage();
                                  }
                             } catch (e) {
                                  console.warn('预取段失败', e);
                             }
                        })());

                        // 当积累到并发上限时，等待已发起的请求完成后继续
                        if (workers.length >= chunkFetchConcurrency) {
                             await Promise.allSettled(workers.splice(0));
                        }
                   }

                   // 等待剩余的工作完成
                   if (workers.length) await Promise.allSettled(workers);

                   hasMoreLeaderboardData = fullLeaderboardData.length >= total;
              } finally {
                   prefetching = false;
              }
         }

         // 更新加载进度 UI（尽量不改动现有 DOM 结构，向 status 添加子项）
         function updateLoadProgress() {
              const status = document.getElementById('status');
              if (!status) return;
              let progress = status.querySelector('.load-progress');
              if (!progress) {
                   progress = document.createElement('span');
                   progress.className = 'load-progress';
                   progress.style.marginLeft = '10px';
                   progress.style.fontSize = '0.9em';
                   progress.style.opacity = '0.9';
                   status.appendChild(progress);
              }
              progress.textContent = `已加载 ${fullLeaderboardData.length}/${totalUsers || '?'} 条`;
         }

         function updateTotalPlaytimeDisplay() {
              const el = document.getElementById('total-playtime');
              if (el) el.textContent = `总游玩时间：${formatPlaytime(totalPlaytime)}`;
         }

         // 简单的 HTML 转义（防止用户名包含特殊字符）
         function escapeHtml(s) {
              if (!s) return '';
              return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
         }