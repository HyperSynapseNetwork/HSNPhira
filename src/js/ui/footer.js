/* footer component: fixed footer per spec (简化) */
(function () {
  'use strict';

  function mountFooter() {
    let f = document.querySelector('.app-footer');
    if (!f) {
      f = document.createElement('footer');
      f.className = 'app-footer glass-card';
      f.innerHTML = '<div class="footer-inner"><span>© 2025-2026 HyperSynapse Network. 保留所有权利</span><button class="btn-capsule footer-contact">联系我们</button></div>';
      document.body.appendChild(f);
    }
    f.querySelector('.footer-contact').addEventListener('click', () => { window.ui && ui.message && ui.message.toast && ui.message.toast.show('跳转公告页（示意）'); });
  }

  document.addEventListener('DOMContentLoaded', mountFooter);
})();
