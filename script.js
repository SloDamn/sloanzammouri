// ========== SCROLL CONTROL HELPERS ==========
const keys = {37: 1, 38: 1, 39: 1, 40: 1, 32: 1, 33: 1, 34: 1, 35: 1, 36: 1};
function preventDefault(e) { e.preventDefault(); }
function preventDefaultForScrollKeys(e) {
  if (keys[e.keyCode]) {
    preventDefault(e);
    return false;
  }
}

function disableScroll() {
  // CRITICAL: Disable CSS smooth scroll to prevent requestAnimationFrame stutter
  document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
  window.addEventListener('wheel', preventDefault, { passive: false });
  window.addEventListener('touchmove', preventDefault, { passive: false });
  window.addEventListener('keydown', preventDefaultForScrollKeys, { passive: false });
}

function enableScroll() {
  document.documentElement.style.removeProperty('scroll-behavior');
  window.removeEventListener('wheel', preventDefault, { passive: false });
  window.removeEventListener('touchmove', preventDefault, { passive: false });
  window.removeEventListener('keydown', preventDefaultForScrollKeys, { passive: false });
}

// ========== LANDING → SITE TRANSITION ==========
document.addEventListener('DOMContentLoaded', () => {
  const landing = document.getElementById('landing');
  const site    = document.getElementById('site');
  const startBtn = document.getElementById('startBtn');

  // Ensure page spawns at very top
  window.scrollTo(0, 0);

  startBtn.addEventListener('click', () => {
    landing.classList.add('fade-out');
    // Lock controls initially
    disableScroll();

    setTimeout(() => {
      landing.style.display = 'none';
      site.classList.add('visible');
      
      // Kick off observers after reveal
      initObservers();
      updateTimeline();

      // Slight breather to let user see top of site, then start cinematic descent
      setTimeout(startCinematicScroll, 800);
    }, 800);
  });
});

// ========== CINEMATIC SCROLL ==========
function startCinematicScroll() {
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (docHeight <= 0) {
    enableScroll();
    return;
  }

  // Exactly 10 seconds traversal
  const duration = 10000; 
  let startTime = null;

  function autoScroll(timestamp) {
    if (!startTime) startTime = timestamp;
    let progress = (timestamp - startTime) / duration;
    if (progress > 1) progress = 1;

    // Smooth Ease-in-out cubic formula
    const ease = progress < 0.5 
      ? 4 * progress * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    window.scrollTo(0, docHeight * ease);

    if (progress < 1) {
      requestAnimationFrame(autoScroll);
    } else {
      // Reached the very bottom! Unlock.
      enableScroll();
    }
  }

  requestAnimationFrame(autoScroll);
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
