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
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
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
      ticking = false;
    });
    ticking = true;
  }
}

// ========== DYNAMIC SPLIT SECTION ============
function updateSplitSections() {
  const splits = document.querySelectorAll('.section--split');
  const h = window.innerHeight;
  // Transition distance halved as requested
  const transitionDistance = h / 2;

  splits.forEach(section => {
    const rect = section.getBoundingClientRect();
    let progress = 0;
    if (rect.top > 0) progress = 0;
    else if (rect.top <= -transitionDistance) progress = 1;
    else progress = -rect.top / transitionDistance;
    section.style.setProperty('--split-progress', progress.toString());
  });

  // Handle nested splits
  const subSplits = document.querySelectorAll('.subsection--split');
  const parentProgressMap = new Map();

  subSplits.forEach(section => {
    const rect = section.getBoundingClientRect();
    let progress = 0;
    
    if (rect.top > 0) {
      progress = 0;
    } else if (rect.top <= 0 && rect.top > -transitionDistance) {
      progress = -rect.top / transitionDistance;
    } else {
      progress = 1;
    }

    // Bottom boundary exit: restore layout back to 0 when exiting.
    // Start exiting exactly when the bottom of this section hits the bottom of the screen (h),
    // meaning the user has finished looking at Part 2 and is pulling up the next section.
    const exitStart = h;
    const exitEnd = h - transitionDistance;
    
    if (rect.bottom <= exitStart && rect.bottom > exitEnd) {
      progress = (rect.bottom - exitEnd) / transitionDistance;
    } else if (rect.bottom <= exitEnd) {
      progress = 0;
    }

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

// ========== TIMELINE HIGHLIGHT ==========
function updateTimeline() {
  const sections = document.querySelectorAll('.section[data-year]');
  const timelineYears = document.querySelectorAll('.timeline-year');
  const timelineProgress = document.getElementById('timelineProgress');

  const viewportCenter = window.innerHeight * 0.42;
  let activeYear = null;
  let bestScore = Infinity;

  sections.forEach(section => {
    const rect = section.getBoundingClientRect();
    // Must be at least partially visible
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    // Distance from the section's vertical midpoint to viewport center
    const midpoint = rect.top + rect.height / 2;
    const dist = Math.abs(midpoint - viewportCenter);
    if (dist < bestScore) {
      bestScore = dist;
      activeYear = section.dataset.year;
    }
  });

  timelineYears.forEach(el => {
    el.classList.toggle('active', el.dataset.year === activeYear);
  });

  // Progress bar: scroll percentage across full document
  const scrollTop  = window.scrollY;
  const docHeight  = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  if (timelineProgress) timelineProgress.style.height = pct + '%';
}
