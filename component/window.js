class MacWindow extends HTMLElement {
  static get observedAttributes() { return ['open']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    const template = document.createElement('template');
    template.innerHTML = `
      <style>
        :host {
          --width: 520px;
          --height: 340px;
          --radius: 12px;
          --glass-bg: rgba(255,255,255,0.10);
          --glass-border: rgba(255,255,255,0.14);
          --shadow: 0 20px 40px rgba(6,8,15,0.45);
          display: block;
          position: fixed;
          inset: 0; /* allow backdrop to cover */
          z-index: var(--mac-window-z, 100001);
          pointer-events: none;
        }

        :host(:not([open])) {
          display: none !important;
          visibility: hidden;
          pointer-events: none;
        }

        :host([open]) {
          display: block;
          visibility: visible;
          pointer-events: auto;
        }

        .backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          opacity: 0;
          transition: opacity 260ms ease;
          pointer-events: none;
          z-index: 0;
        }

        /* stage centers the window */
        .stage {
          width: var(--width);
          height: var(--height);
          transform-style: preserve-3d;
          position: fixed;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -45%) scale(0.98);
          transition: transform 420ms cubic-bezier(.2,.95,.28,1), opacity 260ms ease;
          opacity: 0;
          pointer-events: none;
          z-index: 1;
        }

        .window {
          width: 100%;
          height: 100%;
          border-radius: var(--radius);
          background: linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
          border: 1px solid var(--glass-border);
          backdrop-filter: blur(10px) saturate(120%);
          -webkit-backdrop-filter: blur(10px) saturate(120%);
          box-shadow: var(--shadow);
          position: relative;
          overflow: hidden;
          transform: translateZ(0);
          will-change: transform, opacity;
          pointer-events: auto;
        }

        /* open / close animations */
        :host([open]) .backdrop {
          opacity: 1;
          pointer-events: auto;
        }

        :host([open]) .stage {
          transform: translate(-50%, -50%) scale(1) rotateX(0deg);
          opacity: 1;
          pointer-events: auto;
        }

        /* 3D tilt transform */
        .inner {
          position: absolute;
          inset: 0;
          transform: rotateX(0deg) rotateY(0deg);
          transition: transform 120ms ease-out;
          transform-origin: center center;
        }

        .close {
          position: absolute;
          right: 12px;
          top: 12px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff5f57, #ff3b30);
          box-shadow: 0 1px 0 rgba(0,0,0,0.15) inset, 0 2px 6px rgba(0,0,0,0.2);
          border: 1px solid rgba(0,0,0,0.05);
          cursor: pointer;
          display: inline-block;
          z-index: 2;
        }
        .close:active { transform: scale(0.92); }
        .close:focus { outline: 2px solid rgba(255,95,87,0.25); border-radius:50%; }

        /* default content styling */
        .content {
          padding: 12px;
          height: calc(100% - 12px - 40px);
          overflow: auto;
        }

        /* embedded mode: when host has 'embedded' attribute, remove padding and allow iframe to fill */
        :host([embedded]) .content {
          padding: 0;
          overflow: hidden; /* iframe handles its own scrolling */
        }
          :host([embedded]) ::slotted(iframe) {
            width: 100%;
            height: 100%;
            border: 0;
            display: block;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: thin;
          }
          /* try to hide iframe element scrollbars in webkit (note: doesn't change inner page scrollbars) */
          :host([embedded]) ::slotted(iframe)::-webkit-scrollbar { display: none; }
          /* loading overlay appended as a slotted element */
          :host([embedded]) ::slotted(.window-loader) {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.28);
            z-index: 5;
            pointer-events: none;
          }

        /* small title style for demo */
        ::slotted(h2) {
          margin: 0 0 8px 0;
          font-size: 18px;
          color: #fff;
          letter-spacing: -0.2px;
        }
        ::slotted(p) { color: rgba(255,255,255,0.85); margin: 0; }

        .titlebar {
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          gap: 8px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          background: linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.06));
          z-index: 3;
        }
        .nav-left, .nav-right { display:flex; align-items:center; gap:6px; }
        .nav-btn { background: rgba(255,255,255,0.04); border: none; color: #fff; padding:6px 8px; border-radius:6px; cursor:pointer }
        .title-center { flex:1; display:flex; flex-direction:column; align-items:center; overflow:hidden }
        .title-text { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600 }
        .address-text { font-size:0.75rem; opacity:0.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:70% }
        .open-link { color: #aee; text-decoration:none; padding:4px 6px; border-radius:6px; background: rgba(255,255,255,0.02) }
        .resizer { position: absolute; right: 6px; bottom: 6px; width: 18px; height: 18px; cursor: se-resize; z-index: 4; border-radius:4px; background: rgba(255,255,255,0.03) }

        @media (max-width: 720px) {
          .stage { left: 50%; top: 50%; transform: translate(-50%, -50%) scale(1); }
          .window { border-radius: 10px; }
          .close { width: 16px; height: 16px; right: 10px; top: 10px; }
          .backdrop { background: rgba(0,0,0,0.6); }
        }

      </style>

      <div class="backdrop"></div>
      <div class="stage" role="dialog" aria-modal="true">
        <div class="window">
          <div class="titlebar">
            <div class="nav-left">
              <button class="nav-btn back" title="后退">◀</button>
              <button class="nav-btn forward" title="前进">▶</button>
            </div>
            <div class="title-center">
              <div class="title-text" part="title">窗口</div>
              <div class="address-text" part="address"></div>
            </div>
            <div class="nav-right">
              <a class="open-link" target="_blank" rel="noopener" title="在新标签打开">↗</a>
              <button class="close" aria-label="关闭" title="关闭"></button>
            </div>
          </div>
          <div class="inner">
            <div class="content"><slot></slot></div>
          </div>
          <div class="resizer" title="调整大小"></div>
        </div>
      </div>
    `;

    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._backdrop = this.shadowRoot.querySelector('.backdrop');
    this._stage = this.shadowRoot.querySelector('.stage');
    this._win = this.shadowRoot.querySelector('.window');
    this._inner = this.shadowRoot.querySelector('.inner');
    this._closeBtn = this.shadowRoot.querySelector('.close');

    this._bound = {
      onMove: this._onPointerMove.bind(this),
      onLeave: this._onPointerLeave.bind(this),
      onClose: this._onClose.bind(this),
      onKey: this._onKey.bind(this),
      onBackdropClick: this._onBackdropClick.bind(this)
    };
    this._resizing = false;
    this._currentIframe = null;
    this._currentUrl = '';
  }

  connectedCallback() {
    // default open if attribute present
    if (!this.hasAttribute('role')) this.setAttribute('role', 'application');

    this._stage.addEventListener('pointermove', this._bound.onMove);
    this._stage.addEventListener('pointerleave', this._bound.onLeave);
    this._closeBtn.addEventListener('click', this._bound.onClose);
      // support pointerdown for quicker response on touch devices
      this._closeBtn.addEventListener('pointerdown', this._bound.onClose);
    this._backdrop.addEventListener('click', this._bound.onBackdropClick);

    // wire up titlebar controls
    this._backBtn = this.shadowRoot.querySelector('.nav-btn.back');
    this._forwardBtn = this.shadowRoot.querySelector('.nav-btn.forward');
    this._openLinkAnchor = this.shadowRoot.querySelector('.open-link');
    this._titleText = this.shadowRoot.querySelector('.title-text');
    this._addressText = this.shadowRoot.querySelector('.address-text');
    this._resizer = this.shadowRoot.querySelector('.resizer');
    if (this._backBtn) this._backBtn.addEventListener('click', ()=> this._navigate(-1));
    if (this._forwardBtn) this._forwardBtn.addEventListener('click', ()=> this._navigate(1));
    if (this._resizer) this._resizer.addEventListener('pointerdown', this._onResizerDown.bind(this));

    // keyboard
    this.addEventListener('keydown', this._bound.onKey);
    this.setAttribute('tabindex', '0');

    // initialize small tilt sensitivity settings
    this._maxTilt = 8; // degrees
    this._tiltDepth = 18; // px translateZ on hover

    // ensure focusable for accessibility
    this._focusOnOpen = true;
  }

  disconnectedCallback() {
    this._stage.removeEventListener('pointermove', this._bound.onMove);
    this._stage.removeEventListener('pointerleave', this._bound.onLeave);
    this._closeBtn.removeEventListener('click', this._bound.onClose);
      this._closeBtn.removeEventListener('pointerdown', this._bound.onClose);
    this._backdrop.removeEventListener('click', this._bound.onBackdropClick);
    if (this._backBtn) this._backBtn.removeEventListener('click', ()=> this._navigate(-1));
    if (this._forwardBtn) this._forwardBtn.removeEventListener('click', ()=> this._navigate(1));
    if (this._resizer) this._resizer.removeEventListener('pointerdown', this._onResizerDown);
    this.removeEventListener('keydown', this._bound.onKey);
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'open') {
      if (this.hasAttribute('open')) {
        this.dispatchEvent(new CustomEvent('mac-window-open', { bubbles: true }));
        // focus for keyboard esc
        this.focus();
        // allow pointer events on host while open
        this.style.pointerEvents = 'auto';
        // responsive sizing for mobile
        this._applyResponsiveSizing();
        // install resize listener so size adapts when device rotates / viewport changes
        this._resizeHandler = () => this._applyResponsiveSizing();
        window.addEventListener('resize', this._resizeHandler);

        // try to focus any iframe inside
        const iframe = this.querySelector('iframe');
        if (iframe) {
          setTimeout(() => {
            try { iframe.contentWindow && iframe.contentWindow.focus(); } catch(e){}
          }, 300);
        }
      } else {
        this.dispatchEvent(new CustomEvent('mac-window-close', { bubbles: true }));
        // restore pointer-events
        this.style.pointerEvents = '';
        // clear responsive sizing and resize listener
        this._clearResponsiveSizing();
        if (this._resizeHandler) {
          window.removeEventListener('resize', this._resizeHandler);
          this._resizeHandler = null;
        }
      }
    }
  }

  // public api
  open() { this.setAttribute('open', ''); }
  close() { this.removeAttribute('open'); }
  toggle() { if (this.hasAttribute('open')) this.close(); else this.open(); }

  _onClose(e) {
    if (e) e.stopPropagation();
    // add a closing animation: shrink & fade
    this._playCloseAnimation();
  }

  _onBackdropClick(e) {
    // clicking backdrop closes
    this._onClose(e);
  }

  _playCloseAnimation() {
    // animate the stage and let CSS handle backdrop fade
    this._stage.style.transition = 'transform 260ms cubic-bezier(.2,.9,.2,1), opacity 200ms ease';
    this._stage.style.transform = 'translate(-50%, -45%) scale(0.96) translateY(8px)';
    this._stage.style.opacity = '0';
    setTimeout(() => {
      this.close();
      // restore styles
      this._stage.style.transform = '';
      this._stage.style.opacity = '';
      this._stage.style.transition = '';
      this._clearResponsiveSizing();
    }, 260);
  }

  _onPointerMove(e) {
    const rect = this._stage.getBoundingClientRect();
    const dx = (e.clientX - rect.left) / rect.width - 0.5;
    const dy = (e.clientY - rect.top) / rect.height - 0.5;
    const rotateY = dx * this._maxTilt * -1;
    const rotateX = dy * this._maxTilt;
    const translateZ = Math.max(this._tiltDepth * (1 - Math.hypot(dx, dy) * 2), 0);
    this._inner.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(${translateZ}px)`;
  }

  _onPointerLeave() {
    this._inner.style.transform = 'rotateX(0deg) rotateY(0deg) translateZ(0px)';
  }

  _onResizerDown(e){
    e.preventDefault();
    this._resizing = true;
    const startX = e.clientX, startY = e.clientY;
    const startRect = this._stage.getBoundingClientRect();
    const startW = startRect.width;
    const startH = startRect.height;
    const onMove = (ev)=>{
      const nw = Math.max(280, startW + (ev.clientX - startX));
      const nh = Math.max(220, startH + (ev.clientY - startY));
      this._stage.style.width = nw + 'px';
      this._stage.style.height = nh + 'px';
    };
    const onUp = (ev)=>{
      this._resizing = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      // persist size
      try{
        if (this._currentUrl) {
          window._macWindowSizeCache = window._macWindowSizeCache || {};
          window._macWindowSizeCache[this._currentUrl] = window._macWindowSizeCache[this._currentUrl] || {};
          const rect = this._stage.getBoundingClientRect();
          window._macWindowSizeCache[this._currentUrl].w = Math.round(rect.width);
          window._macWindowSizeCache[this._currentUrl].h = Math.round(rect.height);
        }
      }catch(e){}
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  _navigate(delta){
    if (!this._currentIframe) return;
    try {
      if (delta < 0) this._currentIframe.contentWindow.history.back(); else this._currentIframe.contentWindow.history.forward();
    } catch(e) {
      try { this._currentIframe.contentWindow.postMessage({ type: 'hsn-navigate', delta }, '*'); } catch(e){}
    }
  }

  registerIframe(iframe, url){
    this._currentIframe = iframe;
    this._currentUrl = url || '';
    if (this._openLinkAnchor) this._openLinkAnchor.href = url || '';
    const update = ()=>{
      try{
        const doc = iframe.contentDocument;
        const title = doc && (doc.title || (doc.querySelector && doc.querySelector('h1') && doc.querySelector('h1').textContent)) || iframe.getAttribute('title') || '';
        if (this._titleText) this._titleText.textContent = title || '窗口';
        if (this._addressText) this._addressText.textContent = (iframe.contentWindow && iframe.contentWindow.location && iframe.contentWindow.location.href) || url || '';
      }catch(e){
        if (this._titleText) this._titleText.textContent = url || '窗口';
        if (this._addressText) this._addressText.textContent = url || '';
      }
      try{
        if (this._backBtn) this._backBtn.disabled = !(iframe.contentWindow && iframe.contentWindow.history && iframe.contentWindow.history.length>1);
      }catch(e){}
    };
    iframe.addEventListener('load', ()=>{ update(); setTimeout(update,120); });
    setTimeout(update,120);
  }

  _applyResponsiveSizing() {
    // 移动端自适应
    if (!this._stage) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mobileBreakpoint = 720;
    if (vw <= mobileBreakpoint) {
      const horizontalMargin = 16;
      const verticalMargin = 48;
      const width = Math.max(280, vw - horizontalMargin * 2);
      const height = Math.max(220, vh - verticalMargin * 2);
      this._stage.style.width = width + 'px';
      this._stage.style.height = height + 'px';
      this._stage.style.left = '50%';
      this._stage.style.top = '50%';
      this._stage.style.transform = 'translate(-50%, -50%) scale(1)';
    } else {
      this._stage.style.width = '';
      this._stage.style.height = '';
      this._stage.style.left = '';
      this._stage.style.top = '';
      this._stage.style.transform = '';
    }
  }

  _clearResponsiveSizing() {
    if (!this._stage) return;
    this._stage.style.width = '';
    this._stage.style.height = '';
    this._stage.style.left = '';
    this._stage.style.top = '';
    this._stage.style.transform = '';
  }

  _onKey(e) {
    if (e.key === 'Escape') this._onClose(e);
  }
}

customElements.define('mac-window', MacWindow);

// For compatibility: expose to window
window.MacWindow = MacWindow;
