(() => {
  'use strict';
  const config = window.MBA_EVENTS_CONFIG || {};
  const list = document.getElementById('eventsList');
  const status = document.getElementById('eventsStatus');
  const mapContainer = document.getElementById('melbourneMap');
  const mapStatus = document.getElementById('mapStatus');
  const dateFormat = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne', weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  });
  let selectedCard = null;

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

  function validTimestamp(value) {
    return typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
  }

  function renderAssociationEvents(events) {
    const upcoming = events.filter(event => event && event.approved === true &&
      event.host === 'association' && typeof event.title === 'string' && typeof event.venue === 'string' &&
      typeof event.address === 'string' && event.address.trim() && validTimestamp(event.startsAt) &&
      validTimestamp(event.endsAt) && Date.parse(event.endsAt) > Date.parse(event.startsAt) &&
      Date.parse(event.endsAt) > Date.now()
    ).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    status.textContent = upcoming.length
      ? `${upcoming.length} upcoming association ${upcoming.length === 1 ? 'event' : 'events'} · Melbourne time`
      : 'No upcoming association events listed. Check back soon.';
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
      directions.target = '_blank'; directions.rel = 'noopener noreferrer';
      article.append(card, directions); list.append(article);
      if (!selectedCard) showEvent(event, card);
    });
    if (!upcoming.length) showMap('Melbourne VIC Australia', 'Backgammon around Melbourne');
  }

  function safeSource(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch (_) { return null; }
  }

  function calendarDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
  }

  function renderSisterTournaments(events) {
    const target = document.getElementById('sisterTournamentsList');
    const message = document.getElementById('sisterTournamentsStatus');
    // Date-only entries use the Melbourne calendar date; no start/end time is invented.
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
    const upcoming = events.filter(event => event && event.approved === true &&
      typeof event.title === 'string' && typeof event.organiser === 'string' &&
      calendarDate(event.startDate) && calendarDate(event.endDate || event.startDate) &&
      (event.endDate || event.startDate) >= event.startDate &&
      (event.endDate || event.startDate) >= today && safeSource(event.sourceUrl)
    ).sort((a, b) => a.startDate.localeCompare(b.startDate));
    message.textContent = upcoming.length
      ? `${upcoming.length} upcoming ${upcoming.length === 1 ? 'tournament' : 'tournaments'}`
      : 'No upcoming tournaments listed. Check back soon.';
    const format = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
    upcoming.forEach(event => {
      const card = element('article', 'rounded-2xl border border-parchment-border bg-parchment-card p-5 shadow-sm');
      const dates = format.format(calendarDate(event.startDate)) +
        (event.endDate && event.endDate !== event.startDate ? ` – ${format.format(calendarDate(event.endDate))}` : '');
      card.append(element('p', 'text-xs font-bold text-terracotta', dates));
      card.append(element('h3', 'font-display text-xl font-bold mt-2', event.title));
      card.append(element('p', 'text-sm text-slateNavy font-semibold mt-2', event.organiser));
      if (event.venue) card.append(element('p', 'text-sm text-espresso-soft mt-2', String(event.venue)));
      if (event.description) card.append(element('p', 'text-sm text-espresso-soft mt-3 whitespace-pre-wrap break-words', String(event.description)));
      const source = element('a', 'inline-block mt-4 text-sm font-bold text-slateNavy underline', 'Official event details ↗');
      source.href = safeSource(event.sourceUrl); source.target = '_blank'; source.rel = 'noopener noreferrer';
      card.append(source); target.append(card);
    });
  }

  renderAssociationEvents(Array.isArray(config.associationEvents) ? config.associationEvents : []);
  renderSisterTournaments(Array.isArray(config.sisterClubTournaments) ? config.sisterClubTournaments : []);
})();
