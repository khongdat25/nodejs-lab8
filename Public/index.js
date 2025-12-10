// Drift banner controls: pause on hover / touch and respect reduced-motion
document.addEventListener('DOMContentLoaded', function () {
  const banner = document.querySelector('.drift-banner');
  const track = document.querySelector('.drift-track');
  if (!banner || !track) return;

  // Respect user's reduced-motion preference
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mq.matches) {
    track.style.animationPlayState = 'paused';
    return;
  }

  // Pause animation when user hovers / focuses the banner
  banner.addEventListener('mouseenter', () => { track.style.animationPlayState = 'paused'; });
  banner.addEventListener('mouseleave', () => { track.style.animationPlayState = 'running'; });
  banner.addEventListener('focusin', () => { track.style.animationPlayState = 'paused'; });
  banner.addEventListener('focusout', () => { track.style.animationPlayState = 'running'; });

  // Touch-friendly: toggle pause on tap
  let touchTimer = null;
  banner.addEventListener('touchstart', (e) => {
    // short tap toggles pause; long press does nothing special
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
      // second tap -> resume
      track.style.animationPlayState = 'running';
      return;
    }
    track.style.animationPlayState = 'paused';
    // if no second tap within 300ms, keep paused until touchend resumes
    touchTimer = setTimeout(() => { touchTimer = null; }, 300);
  }, { passive: true });
  banner.addEventListener('touchend', () => {
    // resume after touchend for smooth experience
    track.style.animationPlayState = 'running';
    if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
  });

  // Optional: expose a small API on the banner element for speed control
  // --- JS-driven drift fallback & controls ---
  let rafId = null;
  let lastTs = null;
  let pxOffset = 0;
  let loopWidth = 0;
  let pxPerSecond = 0;

  function getCssDuration() {
    const v = getComputedStyle(banner).getPropertyValue('--drift-duration').trim();
    const n = parseFloat(v);
    return (isNaN(n) || n <= 0) ? 28 : n; // seconds for half-loop
  }

  function calcLoopWidth() {
    // track contains duplicated items so loop width == half of scrollWidth
    loopWidth = track.scrollWidth / 2 || track.scrollWidth;
    if (!loopWidth) loopWidth = 0;
  }

  function updateSpeedFromDuration() {
    const dur = getCssDuration();
    pxPerSecond = loopWidth / dur;
  }

  function animateFrame(ts) {
    if (lastTs == null) lastTs = ts;
    const dt = (ts - lastTs) / 1000; // seconds
    lastTs = ts;
    pxOffset += pxPerSecond * dt;
    if (pxOffset >= loopWidth) pxOffset -= loopWidth;
    track.style.transform = `translateX(${-pxOffset}px)`;
    rafId = requestAnimationFrame(animateFrame);
  }

  function startJSDrift() {
    cancelJSDrift();
    calcLoopWidth();
    updateSpeedFromDuration();
    track.style.willChange = 'transform';
    lastTs = null;
    rafId = requestAnimationFrame(animateFrame);
  }

  function cancelJSDrift() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    lastTs = null;
  }

  // Pause/resume unified handler (works for CSS or JS)
  function pause() {
    // if CSS animation exists, pause it
    track.style.animationPlayState = 'paused';
    // if JS running, stop RAF
    cancelJSDrift();
  }
  function resume() {
    // resume CSS animation
    track.style.animationPlayState = 'running';
    // resume JS if CSS animation not present
    const cs = getComputedStyle(track);
    const hasCssAnim = cs.animationName && cs.animationName !== 'none';
    if (!hasCssAnim) startJSDrift();
  }

  // Hook hover/focus to unified pause/resume
  banner.addEventListener('mouseenter', pause);
  banner.addEventListener('mouseleave', resume);
  banner.addEventListener('focusin', pause);
  banner.addEventListener('focusout', resume);

  // Touch handlers toggle pause briefly
  banner.addEventListener('touchstart', (e) => { pause(); }, { passive: true });
  banner.addEventListener('touchend', () => { resume(); });

  // Expose API
  banner.setDriftSpeed = function (seconds) {
    if (!seconds || seconds <= 0) return;
    banner.style.setProperty('--drift-duration', seconds + 's');
    // update JS speed if active
    calcLoopWidth();
    updateSpeedFromDuration();
  };

  // Wait for images to load so measurements are correct
  const imgs = track.querySelectorAll('img');
  let imgsLeft = imgs.length;
  if (imgsLeft === 0) {
    // no images, start based on CSS availability
    const cs = getComputedStyle(track);
    const hasCssAnim = cs.animationName && cs.animationName !== 'none';
    if (!hasCssAnim) startJSDrift();
  } else {
    imgs.forEach(img => {
      if (img.complete) {
        imgsLeft -= 1;
      } else {
        img.addEventListener('load', () => { imgsLeft -= 1; if (imgsLeft === 0) onImagesReady(); });
        img.addEventListener('error', () => { imgsLeft -= 1; if (imgsLeft === 0) onImagesReady(); });
      }
    });
    if (imgsLeft === 0) onImagesReady();
  }

  function onImagesReady() {
    // decide whether to use CSS or JS
    const cs = getComputedStyle(track);
    const hasCssAnim = cs.animationName && cs.animationName !== 'none';
    if (!hasCssAnim) startJSDrift();
  }
});