// ========== LANDING → SITE TRANSITION ==========
document.addEventListener('DOMContentLoaded', () => {
  const landing = document.getElementById('landing');
  const site    = document.getElementById('site');
  const startBtn = document.getElementById('startBtn');

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  startBtn.addEventListener('click', () => {
    landing.classList.add('fade-out');
    // Jump to the first page while the landing is still covering the site
    pinToBottom();

    setTimeout(() => {
      landing.style.display = 'none';
      site.classList.add('visible');

      // Kick off observers after reveal
      initObservers();
      updateTimeline();
      initScrollDirection();
    }, 800);
  });
});

// ========== START ON THE FIRST PAGE ==========
// Time runs bottom → top, so the first page (Bachelor @EPFL) is the bottom of the document.
let userHasScrolled = false;

function scrollToBottom() {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
}

function pinToBottom() {
  scrollToBottom();
  // Images and videos keep growing the page as they load: stay pinned until the user takes over
  const pin = new ResizeObserver(() => {
    if (userHasScrolled) pin.disconnect();
    else scrollToBottom();
  });
  pin.observe(document.body);
  window.addEventListener('pointerdown', () => { userHasScrolled = true; }, { once: true });
}

// ========== SCROLL DIRECTION LOCK ==========
// The visitor's first scroll decides the direction until reload. Scrolling up is the native
// way to move forward in time; someone who scrolls down first gets an inverted page, so their
// "down" also moves forward in time.
let invertScroll = null; // null until the first gesture

function lockDirection(down) {
  if (invertScroll !== null) return;
  invertScroll = down;
  userHasScrolled = true;
}

function initScrollDirection() {
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onScrollKey);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
}

function maxScroll() {
  return document.documentElement.scrollHeight - window.innerHeight;
}

// Eased scrolling for inverted wheel and keys (native smooth scroll can't be reversed)
let scrollPos = 0, scrollTarget = 0, easing = false;
function smoothScrollBy(delta) {
  if (!easing) scrollPos = scrollTarget = window.scrollY;
  scrollTarget = Math.max(0, Math.min(maxScroll(), scrollTarget + delta));
  if (!easing) {
    easing = true;
    requestAnimationFrame(stepSmoothScroll);
  }
}

function stepSmoothScroll() {
  scrollPos += (scrollTarget - scrollPos) * 0.18;
  if (Math.abs(scrollTarget - scrollPos) < 0.5) scrollPos = scrollTarget;
  window.scrollTo({ top: scrollPos, behavior: 'instant' });
  if (scrollPos !== scrollTarget) requestAnimationFrame(stepSmoothScroll);
  else easing = false;
}

function onWheel(e) {
  if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // zoom or horizontal
  lockDirection(e.deltaY > 0);
  if (!invertScroll) return;
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
  smoothScrollBy(-e.deltaY * unit);
}

const SCROLL_KEYS = { ArrowDown: 1, ArrowUp: -1, PageDown: 1, PageUp: -1, ' ': 1, End: 1, Home: -1 };
function onScrollKey(e) {
  let dir = SCROLL_KEYS[e.key];
  if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === ' ' && e.shiftKey) dir = -dir;
  lockDirection(dir > 0);
  if (!invertScroll) return;
  e.preventDefault();
  const step = e.key.startsWith('Arrow') ? 80
    : (e.key === 'Home' || e.key === 'End') ? Infinity
    : window.innerHeight * 0.85;
  smoothScrollBy(-dir * step);
}

// Inverted touch: drag the page by hand, then glide with momentum
let touchX = null, touchY = null, touchT = 0, touchVel = 0;
function onTouchStart(e) {
  touchX = e.touches[0].clientX;
  touchY = e.touches[0].clientY;
  touchT = e.timeStamp;
  touchVel = 0;
}

function onTouchMove(e) {
  if (touchY === null || e.touches.length > 1) return;
  const x = e.touches[0].clientX;
  const y = e.touches[0].clientY;
  const delta = touchY - y; // > 0 when the finger moves up, i.e. a "scroll down" gesture
  if (delta === 0 || Math.abs(touchX - x) > Math.abs(delta)) return; // horizontal swipe
  lockDirection(delta > 0);
  if (!invertScroll) return;
  if (e.cancelable) e.preventDefault();
  window.scrollBy({ top: -delta, behavior: 'instant' });
  const dt = Math.max(1, e.timeStamp - touchT);
  touchVel = -delta / dt;
  touchX = x;
  touchY = y;
  touchT = e.timeStamp;
}

function onTouchEnd(e) {
  touchY = null;
  if (!invertScroll) return;
  let v = e.timeStamp - touchT > 100 ? 0 : touchVel; // px per ms; finger held still = no glide
  let last = performance.now();
  function glide(now) {
    if (touchY !== null || Math.abs(v) < 0.02) return; // new touch or stopped
    const dt = now - last;
    last = now;
    window.scrollBy({ top: v * dt, behavior: 'instant' });
    v *= Math.pow(0.95, dt / 16);
    requestAnimationFrame(glide);
  }
  requestAnimationFrame(glide);
}

// ========== INTERSECTION OBSERVERS ==========
function initObservers() {
  // ---- Subsection & Sub-subsection reveal ----
  const reveals = document.querySelectorAll('.subsection:not(.subsection--split), .sub-subsection');
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('visible');
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -2% 0px' });
  reveals.forEach(s => revealObs.observe(s));

  // Timeline update on scroll
  window.addEventListener('scroll', onScroll, { passive: true });
  // Initial call
  onScroll();
}

// ========== SCROLL HANDLER ==========
let ticking = false;
function onScroll() {
  if (!ticking) {
    requestAnimationFrame(() => {
      updateTimeline();
      updateSplitSections();
      updateAmbientBackground();
      updateParallax();
      ticking = false;
    });
    ticking = true;
  }
}

// ========== AMBIENT BACKGROUND ==========
function updateAmbientBackground() {
  const ambientBg = document.getElementById('ambient-bg');
  if (!ambientBg) return;

  const colorNodes = document.querySelectorAll('[data-color]');
  let bestNode = null;
  let minDistance = Infinity;
  const viewportCenter = window.innerHeight / 2;

  colorNodes.forEach(node => {
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      let closestPoint = viewportCenter;
      if (rect.bottom < viewportCenter) closestPoint = rect.bottom;
      else if (rect.top > viewportCenter) closestPoint = rect.top;

      const distance = Math.abs(viewportCenter - closestPoint);
      // <= ensures nested/subsequent children that also span the center override their parents
      if (distance <= minDistance) {
        minDistance = distance;
        bestNode = node;
      }
    }
  });

  if (bestNode) {
    ambientBg.style.backgroundColor = bestNode.getAttribute('data-color');
  }
}

// ========== PARALLAX GALLERY ==========
function updateParallax() {
  const parallaxItems = document.querySelectorAll('.art-container');
  const h = window.innerHeight;
  const centerY = h / 2;

  parallaxItems.forEach(item => {
    const rect = item.getBoundingClientRect();
    if (rect.top < h && rect.bottom > 0) {
      const itemCenter = rect.top + rect.height / 2;
      const centerOff = itemCenter - centerY;
      const speed = parseFloat(item.dataset.speed || "0.1");
      const offset = centerOff * speed;
      item.style.setProperty('--parallax-y', offset.toString());
    }
  });
}

// ========== DYNAMIC SPLIT SECTION ============
function updateSplitSections() {
  const splits = document.querySelectorAll('.section--split');
  const h = window.innerHeight;
  const transitionDistance = 300; // Snappier popping into columns

  splits.forEach(section => {
    const rect = section.getBoundingClientRect();
    let progress = 1;

    const startSplit = h; 
    const endSplit = h + transitionDistance;

    if (rect.bottom >= endSplit) progress = 1;
    else if (rect.bottom <= startSplit) progress = 0;
    else progress = (rect.bottom - startSplit) / transitionDistance;

    section.style.setProperty('--split-progress', Math.max(0, Math.min(1, progress)).toString());
  });

  // Handle nested splits
  const subSplits = document.querySelectorAll('.subsection--split');
  const parentProgressMap = new Map();

  subSplits.forEach(section => {
    const rect = section.getBoundingClientRect();
    let progress = 1;
    
    const startSplit = h;
    const endSplit = h + transitionDistance;

    if (rect.bottom >= endSplit) progress = 1;
    else if (rect.bottom <= startSplit) progress = 0;
    else progress = (rect.bottom - startSplit) / transitionDistance;

    section.style.setProperty('--sub-split-progress', Math.max(0, Math.min(1, progress)).toString());

    // Aggregate for parent
    const parent = section.closest('.section--split');
    if (parent) {
      const current = parentProgressMap.get(parent) || 0;
      parentProgressMap.set(parent, Math.max(current, progress));
    }
  });

  // Apply to parents
  parentProgressMap.forEach((val, parent) => {
    parent.style.setProperty('--active-sub-progress', val.toString());
  });
}

// ========== TIMELINE HIGHLIGHT & PROGRESS ==========
function updateTimeline() {
  const timelineYears = document.querySelectorAll('.timeline-year');
  const timelineProgress = document.getElementById('timelineProgress');

  // 1. Calculate inverted scroll percentage (Top=100%, Bottom=0%)
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  let pct = docHeight > 0 ? (1 - (scrollTop / docHeight)) * 100 : 100;
  
  pct = Math.max(0, Math.min(100, pct));

  // 2. Update the visual progress bar height
  if (timelineProgress) {
    timelineProgress.style.height = pct + '%';
    
    // PHYSICAL SYNC: Match dots to the actual visible tip of the bar.
    // This is more robust than percentage math alone.
    const barRect = timelineProgress.getBoundingClientRect();
    const barTip = barRect.top;

    let currentActiveIndex = -1;
    
    timelineYears.forEach((el) => {
      const dot = el.querySelector('.timeline-dot');
      const idx = parseInt(el.dataset.index);
      if (!dot) return;
      
      const dotRect = dot.getBoundingClientRect();
      const dotCenter = dotRect.top + dotRect.height / 2;

      // When the rising bar TIP (barTip) reaches or passes the DOT CENTER.
      // Since it's rising (barTip decreasing), barTip <= dotCenter means it hit it.
      if (barTip <= dotCenter + 2) {
        currentActiveIndex = Math.max(currentActiveIndex, idx);
      }
    });

    timelineYears.forEach(el => {
      const idx = parseInt(el.dataset.index);
      el.classList.toggle('active', idx === currentActiveIndex);
    });
  }
}
