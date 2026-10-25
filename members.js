(() => {
  'use strict';
  const track = document.getElementById('carouselTrack');
  const previous = document.getElementById('carouselPrevBtn');
  const next = document.getElementById('carouselNextBtn');
  const range = document.getElementById('membersRange');
  if (!track || !previous || !next || !range) return;
  const cards = [...track.querySelectorAll('.member-card')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  function dimensions() {
    const style = getComputedStyle(track);
    const gap = parseFloat(style.columnGap) || 0;
    const width = track.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const step = cards.length ? cards[0].getBoundingClientRect().width + gap : width;
    return { step, count: Math.max(1, Math.floor((width + gap + 1) / step)),
      maximum: Math.max(0, track.scrollWidth - track.clientWidth) };
  }

  function move(direction, wholeGroup) {
    const size = dimensions();
    const left = Math.max(0, Math.min(size.maximum,
      track.scrollLeft + direction * size.step * (wholeGroup ? size.count : 1)));
    track.scrollTo({ left, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  }

  function update() {
    const size = dimensions();
    previous.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft >= size.maximum - 1;
    const bounds = track.getBoundingClientRect();
    const style = getComputedStyle(track);
    const left = bounds.left + parseFloat(style.paddingLeft);
    const right = bounds.right - parseFloat(style.paddingRight);
    const visible = cards.map((card, index) => ({ index, bounds: card.getBoundingClientRect() }))
      .filter(card => card.bounds.right > left + 1 && card.bounds.left < right - 1);
    const text = visible.length ? `${visible[0].index + 1}–${visible.at(-1).index + 1} of ${cards.length}` : '';
    if (range.textContent !== text) range.textContent = text;
  }

  previous.addEventListener('click', () => move(-1, true));
  next.addEventListener('click', () => move(1, true));
  track.addEventListener('keydown', event => {
    if (event.target !== track || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(event.key === 'ArrowLeft' ? -1 : 1, false);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      track.scrollTo({ left: event.key === 'Home' ? 0 : dimensions().maximum,
        behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    }
  });
  let pending = false;
  track.addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; update(); });
  }, { passive: true });
  new ResizeObserver(update).observe(track);
  update();
})();
