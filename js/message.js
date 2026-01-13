// Unified message component
(function(){
  const containerId = 'hsn-message-container';
  function ensureContainer(){
    let c = document.getElementById(containerId);
    if (!c){
      c = document.createElement('div');
      c.id = containerId;
      c.style.position = 'fixed';
      c.style.top = '12px';
      c.style.right = '12px';
      c.style.zIndex = 200000;
      c.style.display = 'flex';
      c.style.flexDirection = 'column';
      c.style.gap = '8px';
      document.body.appendChild(c);
    }
    return c;
  }

  function showMessage(title, content, bgColor, timeout=4000){
    const c = ensureContainer();
    const card = document.createElement('div');
    card.style.minWidth = '220px';
    card.style.maxWidth = '420px';
    card.style.background = bgColor || 'rgba(255,255,255,0.06)';
    card.style.backdropFilter = 'blur(12px)';
    card.style.border = '1px solid rgba(255,255,255,0.08)';
    card.style.borderRadius = '12px';
    card.style.padding = '12px';
    card.style.color = '#fff';
    card.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
    card.style.position = 'relative';

    const close = document.createElement('button');
    close.textContent = '×';
    close.style.position = 'absolute';
    close.style.right = '8px';
    close.style.top = '8px';
    close.style.border = 'none';
    close.style.background = 'rgba(255,0,0,0.7)';
    close.style.color = '#fff';
    close.style.width = '20px';
    close.style.height = '20px';
    close.style.borderRadius = '50%';
    close.style.cursor = 'pointer';
    close.addEventListener('click', ()=>{ if (card.parentNode) card.parentNode.removeChild(card); });

    const h = document.createElement('div');
    h.textContent = title || '';
    h.style.fontSize = '16px';
    h.style.fontWeight = '700';
    h.style.marginBottom = '6px';

    const p = document.createElement('div');
    p.innerHTML = content || '';
    p.style.fontSize = '13px';

    card.appendChild(close);
    card.appendChild(h);
    card.appendChild(p);
    c.appendChild(card);

    if (timeout > 0){
      setTimeout(()=>{ try{ if (card.parentNode) card.parentNode.removeChild(card); }catch(e){} }, timeout);
    }
  }

  window.showMessage = showMessage;
})();
