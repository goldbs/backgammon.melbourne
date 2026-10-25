(() => {
  'use strict';
  const track = document.getElementById('carouselTrack');
  const previous = document.getElementById('carouselPrevBtn');
  const next = document.getElementById('carouselNextBtn');
  if (!track || !previous || !next) return;
  const badges = [...track.children];
  if (!badges.length) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // Copies on either side let swipes and arrow clicks cross the boundary naturally.
  function copy(badge) {
    const clone = badge.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.inert = true;
    return clone;
  }
  track.prepend(...badges.map(copy));
  track.append(...badges.map(copy));
  let span = 0;
  let timer;
  function measure() {
    const step = badges[1] ? badges[1].getBoundingClientRect().left - badges[0].getBoundingClientRect().left : badges[0].getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0);
    const newSpan = step * badges.length;
    const progress = span ? ((track.scrollLeft % span) + span) % span / span : 0;
    span = newSpan;
    track.scrollTo({ left: span * (1 + progress), behavior: 'instant' });
  }
  function normalise() {
    if (span && (track.scrollLeft < span || track.scrollLeft >= span * 2)) {
      track.scrollTo({ left: span + ((track.scrollLeft % span) + span) % span, behavior: 'instant' });
    }
  }
  function move(direction) {
    normalise();
    const step = span / badges.length;
    track.scrollTo({ left: track.scrollLeft + direction * step, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  track.addEventListener('keydown', event => {
    if (event.target !== track || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  track.addEventListener('scroll', () => {
    clearTimeout(timer);
    timer = setTimeout(normalise, 160);
  }, { passive: true });
  track.addEventListener('scrollend', normalise);
  new ResizeObserver(measure).observe(track);
  measure();
})();
