// Shared table helper: adds touch-friendly horizontal scroll behavior
// and optional sticky header handling. Auto-initializes tables with class
// "responsive-table".
(function(){
  function initTable(t){
    if (t.__tableComponentInit) return; t.__tableComponentInit = true;
    // make sure the table uses block display for native horizontal scroll
    t.style.display = 'block';
    t.style.overflowX = 'auto';
    t.style.webkitOverflowScrolling = 'touch';

    // add wheel-to-scroll-on-x for desktop mousewheel when shift not held
    t.addEventListener('wheel', function(e){
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)){
        // translate vertical wheel to horizontal scroll for convenience
        t.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });

    // make header visually sticky by cloning header row into a fixed element if desired
    // keep minimal: add shadow when scrolled horizontally to hint overflow
    function updateShadow(){
      if (t.scrollLeft > 0) t.style.boxShadow = 'inset 8px 0 12px -8px rgba(0,0,0,0.4)';
      else t.style.boxShadow = '';
    }
    t.addEventListener('scroll', updateShadow);
    updateShadow();

    // accessibility: expose keyboard horizontal navigation
    t.setAttribute('tabindex','0');
    t.addEventListener('keydown', function(e){
      if (e.key === 'ArrowRight') { t.scrollLeft += 60; e.preventDefault(); }
      if (e.key === 'ArrowLeft') { t.scrollLeft -= 60; e.preventDefault(); }
      if (e.key === 'Home') { t.scrollLeft = 0; }
      if (e.key === 'End') { t.scrollLeft = t.scrollWidth; }
    });
  }

  function scan(){
    document.querySelectorAll('table.responsive-table').forEach(initTable);
    // enable marquee for long scrolling-btn elements
    setTimeout(()=>{
      document.querySelectorAll('.scrolling-btn').forEach(el=>{
        try{
          const span = el.querySelector('span');
          if (span && span.scrollWidth > el.clientWidth) el.classList.add('marquee');
        }catch(e){}
      });
    }, 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();

  // expose for manual init
  window.HSNTable = { init: initTable };
})();
