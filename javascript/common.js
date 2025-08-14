// ===== 全局变量声明 =====
// 当前登录用户信息
let currentUser = null;
// 默认用户头像 URL
const DEFAULT_AVATAR = 'https://phira.moe/assets/user-6212ee95.png';
// 所有用户列表（管理员功能）
let allUsers = [];
// 管理员密码
let adminPassword = '';
// 超级管理员标志
let isSuperAdmin = false;
// API 基础 URL
const API_BASE_URL = 'https://phira.htadiy.cc/postadmin';
// API 认证密码
const API_PWD1 = 'nb3502022';
const API_PWD2 = '2022350';
const API_PWD3 = 'nb3502022outlookcom';

// ===== 状态颜色常量 =====
const STATUS_COLORS = {
    online: '#4caf50',    // 在线状态 - 绿色
    offline: '#f44336',   // 离线状态 - 红色
    loading: '#ffc107',   // 加载中 - 黄色
    unknown: '#9e9e9e'    // 未知状态 - 灰色
};

// ===== 服务器命令配置 =====
const SERVER_COMMANDS = {
    start: 'bash /root/start.sh',     // 启动服务器
    restart: 'bash /root/stop.sh && bash /root/start.sh', // 重启服务器
    stop: 'bash /root/stop.sh',       // 停止服务器
    check: 'bash /root/check.sh'      // 检查服务器状态
};

// ===== 页面加载事件 =====
// 页面加载时检查登录状态
document.addEventListener('DOMContentLoaded', () => {
    // 定义无需登录即可访问的公共页面
    const publicPages = [   
        'index.html',
        'privacy.html',
        'rooms.html'     
    ];
    
    // 获取当前页面文件名
    const currentPage = window.location.pathname.split('/').pop();
    
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateUserDisplay();
        
        // 根据当前页面执行不同初始化
        if (document.querySelector('.admin-container')) {
            initAdminPage();
        } else if (document.querySelector('.account-container')) {
            loadAccountDetails();
        } else if (document.getElementById('rooms-table')) {
            initRoomsPage();
        }
    } else {
        // 如果当前页面不在公共页面列表中，则重定向到登录页
        if (!publicPages.includes(currentPage)) {
            window.location.href = 'index.html';
        }
    }
    
    // 通用事件绑定
    bindCommonEvents();
});

// ===== 管理员页面初始化 =====
function initAdminPage() {
    // 检查用户是否为管理员
    if (currentUser.admin !== "yes") {
        alert('您不是管理员，无法访问此页面');
        window.location.href = 'index.html';
        return;
    }
    // 显示管理员密码输入模态框
    showAdminPasswordModal();
}

// ===== 房间页面初始化 =====
function initRoomsPage() {
    // 获取房间表格容器和表格元素
    const tableContainer = document.getElementById('table-container');
    const roomsTable = document.getElementById('rooms-table');
    
    // 添加3D卡片交互效果
    if (tableContainer && roomsTable) {
        // 鼠标移动事件：实现3D倾斜效果
        tableContainer.addEventListener('mousemove', (e) => {
            if (!roomsTable.classList.contains('tilting')) {
                roomsTable.classList.add('tilting');
            }
            
            // 计算鼠标相对于表格中心的位置
            const rect = tableContainer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // 根据鼠标位置计算旋转角度
            const rotateY = (x - centerX) / centerX * 8;
            const rotateX = (centerY - y) / centerY * 8;
            
            // 应用3D变换
            roomsTable.style.transform = `translateZ(20px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });
        
        // 鼠标离开事件：恢复原始状态
        tableContainer.addEventListener('mouseleave', () => {
            roomsTable.classList.remove('tilting');
            roomsTable.style.transform = 'translateZ(20px) rotateX(0) rotateY(0)';
            
            // 添加轻微摇摆动画
            setTimeout(() => {
                roomsTable.style.animation = 'gentleSway 8s infinite ease-in-out';
            }, 300);
        });
    }
}

// ===== 通用事件绑定 =====
function bindCommonEvents() {
    // 绑定用户信息下拉菜单
    const userInfo = document.querySelector('.user-info');
    if (userInfo) {
        userInfo.addEventListener('click', toggleDropdown);
    }
    
    // 绑定登出按钮
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // 绑定房间页面事件
    if (document.getElementById('rooms-table')) {
        bindRoomsEvents();
    }
}

// ===== 房间页面事件绑定 =====
function bindRoomsEvents() {
    // 获取房间数据并渲染表格
    fetch("/roomsjson")
        .then(res => res.json())
        .then(async rooms => {
            const tbody = document.querySelector("#rooms-table tbody");
            tbody.innerHTML = "";
            
            // 无房间时显示提示信息
            if (rooms.length === 0) {
                tbody.innerHTML = "<tr><td colspan='8'>暂无房间</td></tr>";
                return;
            }
            
            // 遍历每个房间并创建表格行
            for (const room of rooms) {
                let chartText = "暂未选择";
                let chartImg = "暂未选择";
                let downloadBtn = "暂未选择";
                
                // 获取谱面元数据
                if (room.chart) {
                    const meta = await getChartMeta(room.chart);
                    if (meta) {
                        // 设置谱面名称链接
                        chartText = meta.name
                            ? `<a href="https://phira.moe/chart/${room.chart}" target="_blank" class="chart-name-btn">${meta.name}</a>`
                            : `ID: ${room.chart}`;
                        
                        // 设置谱面图片（当前为空，可添加实现）
                        chartImg = meta.illustration
                            ? ``
                            : "无封面";
                        
                        // 设置下载按钮
                        downloadBtn = meta.file
                            ? `<a href="${meta.file}" download="chart_${room.chart}.zip"><button class="dl-btn">下载</button></a>`
                            : "无文件";
                    }
                }
                
                // 创建房间主机按钮
                const hostBtn = `<a href="https://phira.moe/user/${room.host_id}" target="_blank"><button class="chart-btn">${room.host_name}</button></a>`;
                
                // 创建查看用户按钮
                const usersBtn = `<button class="chart-btn" onclick='showUsers(${JSON.stringify(room.user_names || [])}, ${JSON.stringify(room.host_name)})'>查看</button>`;
                
                // 创建表格行
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${room.name}</td>
                    <td>${hostBtn}</td>
                    <td>${room.user_count}</td>
                    <td>${room.cycle ? "是" : "否"}</td>
                    <td>${chartText}</td>
                    <td>${chartImg}</td>
                    <td>${downloadBtn}</td>
                    <td>${usersBtn}</td>
                `;
                tbody.appendChild(tr);
            }
        });
    
    // 检查服务器状态
    fetch("/roomsjson", { method: "HEAD" })
        .then(() => {
            const status = document.getElementById("status");
            status.textContent = "服务器状态：在线 :)  加入我们的QQ群：1049578201";
            status.classList.add("online");
        })
        .catch(() => {
            const status = document.getElementById("status");
            status.textContent = "服务器状态：离线 :(  加入我们的QQ群：1049578201";
            status.classList.add("offline");
        });
}

// ===== 更新用户显示 =====
function updateUserDisplay() {
    const loginButton = document.getElementById('login-button');
    const avatarContainer = document.getElementById('avatar-container');
    
    if (currentUser) {
        // 隐藏登录按钮，显示用户信息
        if (loginButton) loginButton.style.display = 'none';
        if (avatarContainer) avatarContainer.style.display = 'flex';
        
        // 更新用户名显示
        document.getElementById('username-display').textContent = currentUser.name;
        
        // 更新用户头像
        const avatar = document.getElementById('user-avatar');
        if (avatar) avatar.src = currentUser.image_url || DEFAULT_AVATAR;
        
        // 更新下拉菜单中的用户名
        const dropdownUsername = document.getElementById('dropdown-username');
        if (dropdownUsername) dropdownUsername.textContent = currentUser.name;
        
        // 更新Phira个人资料链接
        const phiraLink = document.getElementById('phira-profile-link');
        if (phiraLink && currentUser.phira_id) {
            phiraLink.href = `https://phira.moe/user/${currentUser.phira_id}`;
        }
    } else {
        // 未登录状态：显示登录按钮，隐藏用户信息
        if (loginButton) loginButton.style.display = 'flex';
        if (avatarContainer) avatarContainer.style.display = 'none';
    }
}

// ===== 加载账户详情 =====
function loadAccountDetails() {
    if (!currentUser) return;
    
    // 设置基本账户信息
    document.getElementById('account-name').textContent = currentUser.name;
    document.getElementById('account-id').textContent = currentUser.id;
    document.getElementById('phira-id').textContent = currentUser.phira_id;
    document.getElementById('phira-name').textContent = currentUser.phira_name;
    document.getElementById('info-username').textContent = currentUser.name;
    
    // 设置RKS（Ranking Score）值
    document.getElementById('rks-value').textContent = currentUser.phira_rks ? parseFloat(currentUser.phira_rks).toFixed(2) : '0.00';
    
    // 设置用户头像
    const avatarUrl = currentUser.image_url || DEFAULT_AVATAR;
    document.getElementById('user-avatar-large-img').src = avatarUrl;
    
    // 设置日期信息
    document.getElementById('join-date').textContent = new Date().toISOString().split('T')[0];
    document.getElementById('last-login').textContent = new Date().toLocaleString();
    
    // 设置管理员和开发者状态
    document.getElementById('admin-status').textContent = currentUser.admin === "yes" ? "是" : "否";
    document.getElementById('dev-status').textContent = currentUser.dev === "yes" ? "是" : "否";
    
    // 创建徽章
    const badgesContainer = document.getElementById('account-badges');
    if (badgesContainer) {
        badgesContainer.innerHTML = '';
        
        // 管理员徽章
        if (currentUser.admin === "yes") {
            const adminBadge = document.createElement('span');
            adminBadge.className = 'badge badge-admin';
            adminBadge.textContent = '管理员';
            badgesContainer.appendChild(adminBadge);
        }
        
        // 开发者徽章
        if (currentUser.dev === "yes") {
            const devBadge = document.createElement('span');
            devBadge.className = 'badge badge-dev';
            devBadge.textContent = '开发者';
            badgesContainer.appendChild(devBadge);
        }
    }
}

// ===== 切换下拉菜单 =====
function toggleDropdown() {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// ===== 退出登录 =====
function logout() {
    // 清除本地存储中的用户信息
    localStorage.removeItem('user');
    // 重定向到登录页
    window.location.href = 'index.html';
}

// ===== 管理员功能 =====

// 显示管理员密码模态框
function showAdminPasswordModal() {
    document.getElementById('admin-password-modal').style.display = 'flex';
}

// 关闭管理员密码模态框
function closeAdminPasswordModal() {
    document.getElementById('admin-password-modal').style.display = 'none';
}

// 验证管理员密码
function verifyAdminPassword() {
    const password = document.getElementById('admin-password-input').value;
    const messageElement = document.getElementById('admin-password-message');
    
    // 检查密码是否为空
    if (!password) {
        showMessage(messageElement, '请输入管理员密码', false);
        return;
    }
    
    // 发送验证请求
    fetch('/usermgr/admin/users', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // 验证成功，保存密码和权限状态
            adminPassword = password;
            isSuperAdmin = data.users.some(u => u.password);
            // 关闭模态框
            document.getElementById('admin-password-modal').style.display = 'none';
            // 加载所有用户
            loadAllUsers();
        } else {
            // 显示错误信息
            showMessage(messageElement, data.message || '密码验证失败', false);
        }
    })
    .catch(() => {
        showMessage(messageElement, '网络错误，请重试', false);
    });
}

// 加载所有用户
function loadAllUsers() {
    fetch('/usermgr/admin/users', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ password: adminPassword })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // 保存用户列表并更新显示
            allUsers = data.users;
            document.getElementById('total-users').textContent = allUsers.length;
            renderUsersTable(allUsers);
        } else {
            showAdminMessage(data.message || '加载用户数据失败', false);
        }
    })
    .catch(() => {
        showAdminMessage('网络错误，请重试', false);
    });
}

// 渲染用户表格
function renderUsersTable(users) {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = '';
    
    // 获取过滤条件
    const searchName = document.getElementById('search-name').value.toLowerCase();
    const searchPhira = document.getElementById('search-phira').value.toLowerCase();
    const filterAdmin = document.getElementById('filter-admin').value;
    const filterDev = document.getElementById('filter-dev').value;
    
    // 过滤用户
    const filteredUsers = users.filter(user => {
        return user.name.toLowerCase().includes(searchName) &&
               user.phira_id.toLowerCase().includes(searchPhira) &&
               (filterAdmin === 'all' || user.admin === filterAdmin) &&
               (filterDev === 'all' || user.dev === filterDev);
    });
    
    // 创建表格行
    filteredUsers.forEach(user => {
        const row = document.createElement('tr');
        row.className = 'user-row';
        row.innerHTML = `
            <td><input type="checkbox" class="user-select" data-id="${user.id}" /></td>
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td></td>
            <td>${user.phira_id}</td>
            <td>${user.phira_name}</td>
            <td>${user.phira_rks ? parseFloat(user.phira_rks).toFixed(2) : '0.00'}</td>
            <td>
                ${user.admin === 'yes' ? '<span class="badge badge-admin">管理员</span>' : ''}
                ${user.dev === 'yes' ? '<span class="badge badge-dev">开发者</span>' : ''}
            </td>
            <td class="actions-cell">
                <button class="action-btn btn-edit" onclick="openEditModal(${user.id})">编辑</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// 打开编辑模态框
function openEditModal(userId) {
    // 查找用户
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    // 填充表单
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-username').value = user.name;
    document.getElementById('edit-phira-id').value = user.phira_id;
    document.getElementById('edit-admin').value = user.admin;
    document.getElementById('edit-dev').value = user.dev;
    
    // 设置密码显示
    document.getElementById('password-display').dataset.original = user.password;
    document.getElementById('password-display').textContent = '************';
    document.getElementById('edit-message').style.display = 'none';
    
    // 显示模态框
    document.getElementById('edit-modal').style.display = 'flex';
}

// 关闭编辑模态框
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

// 保存用户更改
function saveUserChanges() {
    // 获取表单数据
    const userId = parseInt(document.getElementById('edit-user-id').value);
    const username = document.getElementById('edit-username').value;
    const password = document.getElementById('edit-password').value;
    const phiraId = document.getElementById('edit-phira-id').value;
    const admin = document.getElementById('edit-admin').value;
    const dev = document.getElementById('edit-dev').value;
    
    // 构建变更对象
    const changes = { name: username, admin, dev };
    if (phiraId) changes.phira_id = phiraId;
    if (password) changes.password = password;
    
    // 发送更新请求
    fetch('/usermgr/admin/update', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            password: adminPassword,
            user_id: userId,
            changes
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // 更新成功
            showEditMessage('用户信息更新成功', true);
            setTimeout(() => {
                closeEditModal();
                loadAllUsers();
            }, 1500);
        } else {
            showEditMessage(data.message || '更新失败', false);
        }
    })
    .catch(() => {
        showEditMessage('网络错误，请重试', false);
    });
}

// 批量选择用户
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
    // 获取选择的用户ID
    const action = document.getElementById('batch-action').value;
    const selectedUserIds = [];
    
    document.querySelectorAll('.user-select:checked').forEach(checkbox => {
        selectedUserIds.push(parseInt(checkbox.dataset.id));
    });
    
    // 检查是否选择了用户
    if (selectedUserIds.length === 0) {
        showAdminMessage('请选择至少一个用户', false);
        return;
    }
    
    // 根据操作类型构建变更
    let changes = {};
    switch (action) {
        case 'set_admin': changes.admin = 'yes'; break;
        case 'remove_admin': changes.admin = 'no'; break;
        case 'set_dev': changes.dev = 'yes'; break;
        case 'remove_dev': changes.dev = 'no'; break;
    }
    
    // 发送批量更新请求
    fetch('/usermgr/admin/batch-update', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            password: adminPassword,
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
            // 重新加载用户列表
            loadAllUsers();
        } else {
            showAdminMessage(data.message || '批量更新失败', false);
        }
    })
    .catch(() => {
        showAdminMessage('网络错误，请重试', false);
    });
}

// ===== 消息显示函数 =====

// 显示管理员消息
function showAdminMessage(message, isSuccess) {
    showMessage(document.getElementById('admin-message'), message, isSuccess);
    setTimeout(() => {
        document.getElementById('admin-message').style.display = 'none';
    }, 5000);
}

// 显示编辑消息
function showEditMessage(message, isSuccess) {
    showMessage(document.getElementById('edit-message'), message, isSuccess);
}

// 通用消息显示
function showMessage(element, message, isSuccess) {
    if (!element) return;
    element.textContent = message;
    element.className = `message ${isSuccess ? 'message-success' : 'message-error'}`;
    element.style.display = 'block';
}

// ===== 房间页面功能 =====

// 显示图片灯箱
function showLightbox(src) {
    const lb = document.getElementById("lightbox");
    document.getElementById("lightbox-img").src = src;
    lb.style.display = "flex";
    requestAnimationFrame(() => lb.classList.add("active"));
}

// 隐藏灯箱
function hideLightbox() {
    const lb = document.getElementById("lightbox");
    lb.classList.remove("active");
    setTimeout(() => {
        lb.style.display = "none";
        document.getElementById("lightbox-img").src = "";
    }, 300);
}

// 显示用户列表模态框
function showUsers(users, host) {
    const modal = document.getElementById("user-modal");
    const list = document.getElementById("user-list");
    // 创建用户列表，高亮显示房主
    list.innerHTML = users.map(name => 
        `<li class="${name === host ? 'highlight-host' : ''}">${name}</li>`
    ).join("");
    modal.style.display = "flex";
}

// 关闭模态框
function closeModal() {
    document.getElementById("user-modal").style.display = "none";
}

// 获取谱面元数据
async function getChartMeta(chartId) {
    try {
        const res = await fetch(`https://phira.5wyxi.com/chart/${chartId}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        return null;
    }
}

// ===== 服务器管理功能 =====

// 检查所有状态
function checkAllStatus() {
    checkApiStatus();
    checkServerStatus();
}

// 检查API状态
function checkApiStatus() {
    // 更新状态为"检测中"
    updateStatus('apiStatus', 'apiStatusDot', '检测中...', 'loading');
    
    fetch('https://phira.htadiy.cc/roomsjson', { cache: 'no-store' })
    .then(response => {
        if (!response.ok) throw new Error('API响应错误');
        return response.json();
    })
    .then(data => {
        // API在线
        updateStatus('apiStatus', 'apiStatusDot', '在线', 'online');
    })
    .catch(() => {
        // API离线
        updateStatus('apiStatus', 'apiStatusDot', '离线', 'offline');
    });
}

// 检查服务器状态
function checkServerStatus() {
    // 更新状态为"检测中"
    updateStatus('serverStatus', 'serverStatusDot', '检测中...', 'loading');
    
    // 发送检查命令
    sendAuthenticatedCommand('custom', SERVER_COMMANDS.check)
        .then(response => {
            if (!response.ok) throw new Error('服务器响应错误');
            return response.json();
        })
        .then(data => {
            if (data.status === "success") {
                // 服务器运行中
                updateStatus('serverStatus', 'serverStatusDot', '运行中', 'online');
            } else {
                // 服务器已停止
                updateStatus('serverStatus', 'serverStatusDot', '已停止', 'offline');
            }
        })
        .catch(() => {
            // 服务器已停止
            updateStatus('serverStatus', 'serverStatusDot', '已停止', 'offline');
        });
}

// 更新状态显示
function updateStatus(textId, dotId, text, status) {
    const textElement = document.getElementById(textId);
    const dotElement = document.getElementById(dotId);
    
    // 更新文本和状态指示灯
    if (textElement) textElement.textContent = text;
    if (dotElement) dotElement.style.backgroundColor = STATUS_COLORS[status] || STATUS_COLORS.unknown;
}

// 发送认证命令
function sendAuthenticatedCommand(command, customCmd = null) {
    // 构建请求参数
    const params = new URLSearchParams();
    params.append('pwd1', API_PWD1);
    params.append('pwd2', API_PWD2);
    params.append('pwd3', API_PWD3);
    
    // 添加命令参数
    if (customCmd) {
        params.append('cmd', 'custom');
        params.append('custom_cmd', customCmd);
    } else {
        params.append('cmd', command);
    }
    
    // 发送请求
    return fetch(`${API_BASE_URL}/execute`, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: params
    });
}

// 执行服务器命令
function executeServerCommand(commandType) {
    if (!SERVER_COMMANDS[commandType]) return;
    
    const commandOutput = document.getElementById('commandOutput');
    if (commandOutput) commandOutput.textContent = '执行中...';
    
    // 发送命令
    sendAuthenticatedCommand('custom', SERVER_COMMANDS[commandType])
        .then(response => response.text())
        .then(data => {
            if (commandOutput) {
                // 显示命令输出
                commandOutput.textContent = data;
                // 2秒后重新检查状态
                setTimeout(checkServerStatus, 2000);
            }
        })
        .catch(error => {
            if (commandOutput) commandOutput.textContent = `错误: ${error.message || '执行失败'}`;
        });
}

// 执行自定义命令
function executeCustomCommand() {
    const command = document.getElementById('customCommand').value.trim();
    const commandOutput = document.getElementById('commandOutput');
    
    // 检查命令是否为空
    if (!command) {
        if (commandOutput) commandOutput.textContent = '错误：请输入命令';
        return;
    }
    
    if (commandOutput) commandOutput.textContent = '执行中...';
    
    // 发送命令
    sendAuthenticatedCommand('custom', command)
        .then(response => response.text())
        .then(data => {
            if (commandOutput) {
                // 显示输出结果
                commandOutput.textContent = data;
                document.getElementById('customCommand').value = '';
            }
        })
        .catch(error => {
            if (commandOutput) commandOutput.textContent = `错误: ${error.message || '执行失败'}`;
        });
}

// ===== 用户认证功能 =====

// 认证模式（登录/注册）
let authMode = 'login';

// 打开认证模态框
function openAuth() {
    document.getElementById('auth-modal').style.display = 'flex';
    document.getElementById('auth-msg').textContent = '';
    updateAuthUI();
}

// 关闭认证模态框
function closeAuth() {
    document.getElementById('auth-modal').style.display = 'none';
}

// 切换认证模式
function toggleAuthMode() {
    authMode = authMode === 'login' ? 'register' : 'login';
    updateAuthUI();
}

// 更新认证UI
function updateAuthUI() {
    const title = document.getElementById('auth-title');
    const phiraid = document.getElementById('auth-phiraid');
    if (!title || !phiraid) return;
    
    // 根据模式更新界面
    if (authMode === 'login') {
        title.textContent = '用户登录';
        phiraid.classList.add('collapsed'); // 隐藏Phira ID字段
    } else {
        title.textContent = '用户注册';
        phiraid.classList.remove('collapsed'); // 显示Phira ID字段
    }
}

// 提交认证表单
async function submitAuth() {
    // 获取表单值
    const name = document.getElementById('auth-name').value;
    const password = document.getElementById('auth-password').value;
    const phira_id = document.getElementById('auth-phiraid').value;
    const msg = document.getElementById('auth-msg');
    if (!msg) return;
    
    msg.textContent = '处理中...';
    
    try {
        // 发送登录/注册请求
        const res = await fetch(`/usermgr/${authMode}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(
                authMode === 'login' 
                    ? { name, password } 
                    : { name, password, phira_id }
            )
        });
        const data = await res.json();
        if (data.status === 'success') {
            // 认证成功
            currentUser = data.user || { name };
            // 保存用户信息到本地存储
            localStorage.setItem('user', JSON.stringify(currentUser));
            // 更新用户显示
            updateUserDisplay();
            
            msg.textContent = '操作成功！';
            setTimeout(() => {
                closeAuth();
                msg.textContent = '';
                // 如果在账户页面，重新加载账户详情
                if (document.querySelector('.account-container')) loadAccountDetails();
            }, 1000);
        } else {
            msg.textContent = data.message || '操作失败';
        }
    } catch (e) {
        msg.textContent = '网络错误';
    }
}

// ===== 账户设置功能 =====

// 更新用户名
function updateUsername() {
    const newUsername = document.getElementById('new-username').value;
    const password = document.getElementById('username-password').value;
    
    // 验证输入
    if (!newUsername) {
        showMessage(document.getElementById('username-message'), '请输入新的用户名', false);
        return;
    }
    
    if (!password) {
        showMessage(document.getElementById('username-message'), '请输入当前密码', false);
        return;
    }
    
    // 发送更新请求
    fetch('/usermgr/update_account', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            user_id: currentUser.id,
            current_password: password,
            new_username: newUsername
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // 更新成功，保存新用户名
            currentUser.name = newUsername;
            localStorage.setItem('user', JSON.stringify(currentUser));
            updateUserDisplay();
            showMessage(document.getElementById('username-message'), '用户名更新成功！', true);
        } else {
            showMessage(document.getElementById('username-message'), data.message || '更新失败', false);
        }
    })
    .catch(() => {
        showMessage(document.getElementById('username-message'), '网络错误，请重试', false);
    });
}

// 更新密码
function updatePassword() {
    // 获取表单值
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // 验证输入
    if (!currentPassword) {
        showMessage(document.getElementById('password-message'), '请输入当前密码', false);
        return;
    }
    
    if (!newPassword) {
        showMessage(document.getElementById('password-message'), '请输入新密码', false);
        return;
    }
    
    // 检查密码长度
    if (newPassword.length < 6) {
        showMessage(document.getElementById('password-message'), '密码长度至少为6个字符', false);
        return;
    }
    
    // 检查密码是否匹配
    if (newPassword !== confirmPassword) {
        showMessage(document.getElementById('password-message'), '新密码与确认密码不匹配', false);
        return;
    }
    
    // 发送更新请求
    fetch('/usermgr/update_account', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            user_id: currentUser.id,
            current_password: currentPassword,
            new_password: newPassword
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showMessage(document.getElementById('password-message'), '密码更新成功！', true);
        } else {
            showMessage(document.getElementById('password-message'), data.message || '更新失败', false);
        }
    })
    .catch(() => {
        showMessage(document.getElementById('password-message'), '网络错误，请重试', false);
    });
}