(() => {
  'use strict';
  const config = window.MBA_EVENTS_CONFIG || {};
  const endpoint = config.eventsEndpoint;
  const list = document.getElementById('eventsList');
  const status = document.getElementById('eventsStatus');
  const mapContainer = document.getElementById('melbourneMap');
  const mapStatus = document.getElementById('mapStatus');
  const dialog = document.getElementById('eventDialog');
  const form = document.getElementById('eventForm');
  const submit = document.getElementById('submitEventBtn');
  const feedback = document.getElementById('eventFormStatus');
  const dateFormat = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne', weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  });
  let selectedCard = null;
  let serviceReady = false;
  const setupStatus = document.getElementById('eventSetupStatus');

  function setServiceReady(ready) {
    serviceReady = ready;
    submit.disabled = !ready;
    setupStatus.textContent = ready
      ? 'Only confirmed member events are shown publicly. Check your inbox after submitting.'
      : 'Event submissions aren’t open yet. Please check back soon.';
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showMap(query, title) {
    const frame = document.createElement('iframe');
    frame.title = title;
    frame.src = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    frame.className = 'w-full h-full border-0';
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer-when-downgrade';
    frame.allowFullscreen = true;
    mapContainer.replaceChildren(frame);
    mapStatus.textContent = title;
  }

  function showEvent(event, card) {
    if (selectedCard) {
      selectedCard.setAttribute('aria-pressed', 'false');
      selectedCard.classList.remove('ring-2', 'ring-terracotta');
    }
    selectedCard = card;
    card.setAttribute('aria-pressed', 'true');
    card.classList.add('ring-2', 'ring-terracotta');
    showMap(event.address, `${event.title} — ${event.venue}`);
  }

  function renderEvents(events) {
    // Verification and membership checks must also be enforced by the server.
    const upcoming = events.filter(event =>
      event.status === 'confirmed' && typeof event.id === 'string' &&
      typeof event.title === 'string' && typeof event.venue === 'string' &&
      typeof event.address === 'string' && event.address.trim() &&
      /(?:Z|[+-]\d{2}:\d{2})$/.test(event.startsAt || '') &&
      /(?:Z|[+-]\d{2}:\d{2})$/.test(event.endsAt || '') &&
      Number.isFinite(Date.parse(event.startsAt)) &&
      Date.parse(event.endsAt) > Date.parse(event.startsAt) && Date.parse(event.endsAt) > Date.now()
    ).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    list.replaceChildren();
    selectedCard = null;
    status.textContent = upcoming.length
      ? `${upcoming.length} upcoming ${upcoming.length === 1 ? 'event' : 'events'} · Times shown in Melbourne time`
      : 'No confirmed upcoming events yet. Be the first to bring people together.';
    upcoming.forEach(event => {
      const article = element('article', 'rounded-2xl border border-parchment-border bg-parchment-light overflow-hidden shadow-sm');
      const card = element('button', 'w-full text-left p-4 hover:bg-parchment-card transition-colors');
      card.type = 'button';
      card.setAttribute('aria-pressed', 'false');
      card.setAttribute('aria-label', `Show ${event.title} on the map`);
      card.append(element('span', 'block text-xs font-bold text-terracotta', dateFormat.format(new Date(event.startsAt))));
      card.append(element('span', 'block text-lg font-display font-bold mt-2', event.title));
      card.append(element('span', 'block text-sm text-slateNavy font-semibold mt-1', event.venue));
      card.append(element('span', 'block text-xs text-espresso-soft mt-1', event.address));
      card.append(element('span', 'block text-xs text-espresso-soft mt-2', `Until ${dateFormat.format(new Date(event.endsAt))}`));
      if (event.format) card.append(element('span', 'inline-block mt-3 rounded-full bg-parchment-card px-3 py-1 text-xs font-semibold', String(event.format)));
      if (event.description) card.append(element('span', 'block mt-3 text-sm text-espresso-soft whitespace-pre-wrap break-words', String(event.description)));
      card.addEventListener('click', () => showEvent(event, card));
      const directions = element('a', 'block px-4 pb-4 text-xs font-bold text-terracotta underline', 'Directions in Google Maps ↗');
      directions.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.address)}`;
      directions.target = '_blank';
      directions.rel = 'noopener noreferrer';
      article.append(card, directions);
      list.append(article);
      if (!selectedCard) showEvent(event, card);
    });
    if (!upcoming.length) showMap('Melbourne VIC Australia', 'Find your next game in Melbourne');
  }

  async function loadEvents() {
    if (!endpoint) {
      status.textContent = 'The community calendar is coming soon.';
      showMap('Melbourne VIC Australia', 'Backgammon around Melbourne');
      return;
    }
    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Event request failed');
      const data = await response.json();
      if (data.eventsVersion !== 1 || !Array.isArray(data.events)) {
        setServiceReady(false);
        status.textContent = 'The community calendar is coming soon.';
        showMap('Melbourne VIC Australia', 'Backgammon around Melbourne');
        return;
      }
      setServiceReady(true);
      renderEvents(data.events);
    } catch (_) {
      setServiceReady(false);
      showMap('Melbourne VIC Australia', 'Backgammon around Melbourne');
      status.textContent = 'We couldn’t load the events. Please try again.';
      const retry = element('button', 'underline font-bold text-terracotta ml-2', 'Retry');
      retry.type = 'button';
      retry.addEventListener('click', () => { status.textContent = 'Loading upcoming events…'; loadEvents(); });
      status.append(retry);
    }
  }

  document.getElementById('addEventBtn').addEventListener('click', () => dialog.showModal());
  document.getElementById('closeEventBtn').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  setServiceReady(false);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!endpoint || !serviceReady || submit.disabled || !form.reportValidity()) return;
    const fields = Object.fromEntries(new FormData(form));
    if (fields.endsAt <= fields.startsAt) {
      feedback.textContent = 'The end time must be after the start time.';
      return;
    }
    // Local wall-clock values are interpreted in Melbourne by the backend,
    // independent of the visitor’s device timezone (including daylight saving).
    const payload = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim()]));
    if (!payload.title || !payload.venue || !payload.address) {
      feedback.textContent = 'Enter an event name, venue and street address.';
      return;
    }
    payload.action = 'submitEvent';
    payload.timeZone = 'Australia/Melbourne';
    submit.disabled = true;
    feedback.textContent = 'Requesting your confirmation email…';
    try {
      // Avoid posting to the older backend, which treats unknown actions as matches.
      const readiness = await fetch(endpoint);
      if (!readiness.ok || (await readiness.json()).eventsVersion !== 1) {
        setServiceReady(false);
        feedback.textContent = 'Event submissions are temporarily unavailable. Please try later.';
        return;
      }
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Submission failed');
      const result = await response.json();
      if (result.status === 'error') {
        feedback.textContent = typeof result.error === 'string' ? result.error.slice(0, 250) : 'Please check your event details.';
        return;
      }
      if (result.status !== 'pending_verification') throw new Error('Unconfirmed submission');
      form.reset();
      feedback.textContent = 'If this address belongs to a member, a confirmation link has been sent. Your event stays private until you confirm it. Check your spam folder too.';
    } catch (_) {
      feedback.textContent = 'We couldn’t confirm the submission. Check your inbox before trying again; your event has not been added to the public map.';
    } finally {
      submit.disabled = !serviceReady;
    }
  });
  loadEvents();
})();
