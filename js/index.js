         // 复制QQ群号功能
         function copyQQ() {
              // 使用现代Clipboard API [6,7](@ref)
              if (navigator.clipboard && navigator.clipboard.writeText) {
                   navigator.clipboard.writeText('1049578201')
                        .then(() => showToast('QQ群号已复制！'))
                        .catch(() => {
                             // 如果现代API失败，回退到传统方法 [1,4](@ref)
                             fallbackCopyText('1049578201', 'QQ群号');
                        });
              } else {
                   // 使用传统的execCommand方法作为备选方案 [1,2](@ref)
                   fallbackCopyText('1049578201', 'QQ群号');
              }
         }

         // 复制服务器地址功能
         function copyServerAddress() {
              if (navigator.clipboard && navigator.clipboard.writeText) {
                   navigator.clipboard.writeText('service.htadiy.cc:7865')
                        .then(() => showToast('服务器地址已复制！'))
                        .catch(() => {
                             fallbackCopyText('service.htadiy.cc:7865', '服务器地址');
                        });
              } else {
                   fallbackCopyText('service.htadiy.cc:7865', '服务器地址');
              }
         }

         // 传统复制方法作为备选 [1,4,6](@ref)
         function fallbackCopyText(text, type) {
              // 创建临时的textarea元素 [4,7](@ref)
              const textArea = document.createElement('textarea');
              textArea.value = text;
              textArea.style.position = 'fixed';
              textArea.style.top = '0';
              textArea.style.left = '0';
              textArea.style.opacity = '0';
              
              document.body.appendChild(textArea);
              textArea.focus();
              textArea.select();
              
              try {
                   // 执行复制命令 [1,6](@ref)
                   const successful = document.execCommand('copy');
                   document.body.removeChild(textArea);
                   if (successful) {
                        showToast(`${type}已复制！`);
                   } else {
                        showToast(`复制失败，请手动选择并复制`);
                   }
              } catch (err) {
                   document.body.removeChild(textArea);
                   showToast(`复制失败，请手动选择并复制`);
              }
         }

         // 显示操作提示
         function showToast(message) {
              const toast = document.getElementById('toast');
              toast.textContent = message;
              toast.classList.add('show');
              
              setTimeout(() => {
                   toast.classList.remove('show');
              }, 3000);
         }

         // 页面滚动动画
         const observer = new IntersectionObserver((entries) => {
              entries.forEach(entry => {
                   if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                   }
              });
         }, { threshold: 0.3 });

         document.querySelectorAll('section').forEach(section => {
              observer.observe(section);
         });

         // 获取用户数量
         fetch("/api/auth/visited/count")
              .then(res => res.json())
              .then(data => {
                   const count = data;
                   document.getElementById("user-count").innerText = `已有 ${count} 位用户使用过我们的服务器`;
              })
              .catch(() => {
                   document.getElementById("user-count").innerText = "无法加载用户数据";
              });