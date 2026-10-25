(() => {
  'use strict';
  const config = window.MBA_EVENTS_CONFIG || {};
  const list = document.getElementById('eventsList');
  const status = document.getElementById('eventsStatus');
  const mapContainer = document.getElementById('melbourneMap');
  const mapStatus = document.getElementById('mapStatus');
  const dateTimeFormat = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne', weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  });
  const dateFormat = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric'
  });
  const dayFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit'
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
    showMap(event.address, `${event.title} — ${event.venue || event.address}`);
  }

  function validTimestamp(value) {
    return typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
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

  function hasLocation(event) {
    return typeof event.address === 'string' && Boolean(event.address.trim());
  }

  const association = (Array.isArray(config.associationEvents) ? config.associationEvents : [])
    .filter(event => event && event.approved === true && event.host === 'association' &&
      typeof event.title === 'string' && event.title.trim() && typeof event.venue === 'string' &&
      hasLocation(event) && validTimestamp(event.startsAt) && validTimestamp(event.endsAt) &&
      Date.parse(event.endsAt) > Date.parse(event.startsAt) && Date.parse(event.endsAt) > Date.now())
    .map(event => ({ ...event,
      organiser: 'Melbourne Backgammon Association',
      dateLabel: dateTimeFormat.format(new Date(event.startsAt)),
      endLabel: `Until ${dateTimeFormat.format(new Date(event.endsAt))}`,
      sortDate: dayFormat.format(new Date(event.startsAt)),
      sortTime: Date.parse(event.startsAt), source: safeSource(event.sourceUrl)
    }));

  const today = dayFormat.format(new Date());
  const otherClubs = (Array.isArray(config.sisterClubTournaments) ? config.sisterClubTournaments : [])
    .filter(event => event && event.approved === true && typeof event.title === 'string' && event.title.trim() &&
      typeof event.organiser === 'string' && event.organiser.trim() && hasLocation(event) &&
      calendarDate(event.startDate) && calendarDate(event.endDate || event.startDate) &&
      (event.endDate || event.startDate) >= event.startDate &&
      (event.endDate || event.startDate) >= today && safeSource(event.sourceUrl))
    .map(event => ({ ...event,
      dateLabel: dateFormat.format(calendarDate(event.startDate)) +
        (event.endDate && event.endDate !== event.startDate
          ? ` – ${dateFormat.format(calendarDate(event.endDate))}` : ''),
      endLabel: '', sortDate: event.startDate, sortTime: 0, source: safeSource(event.sourceUrl)
    }));

  // One approved calendar: MBA events and other clubs share ordering and map selection.
  // Date-only tournaments retain their published calendar dates; no time is invented.
  const upcoming = [...association, ...otherClubs].sort((a, b) =>
    a.sortDate.localeCompare(b.sortDate) || a.sortTime - b.sortTime || a.title.localeCompare(b.title));
  status.textContent = upcoming.length
    ? `${upcoming.length} upcoming ${upcoming.length === 1 ? 'event' : 'events'} · Times shown in Melbourne time`
    : 'No upcoming events listed. Check back soon.';

  upcoming.forEach(event => {
    const article = element('article', 'rounded-2xl border border-parchment-border bg-parchment-light overflow-hidden shadow-sm');
    const card = element('button', 'w-full text-left p-4 hover:bg-parchment-card transition-colors');
    card.type = 'button';
    card.setAttribute('aria-pressed', 'false');
    card.setAttribute('aria-label', `Show ${event.title} on the map`);
    card.append(element('span', 'block text-xs font-bold text-terracotta', event.dateLabel));
    card.append(element('span', 'block text-lg font-display font-bold mt-2', event.title));
    card.append(element('span', 'block text-xs text-slateNavy font-semibold mt-2', `Hosted by ${event.organiser}`));
    if (event.venue) card.append(element('span', 'block text-sm font-semibold mt-2', String(event.venue)));
    card.append(element('span', 'block text-xs text-espresso-soft mt-1', event.address));
    if (event.endLabel) card.append(element('span', 'block text-xs text-espresso-soft mt-2', event.endLabel));
    if (event.format) card.append(element('span', 'inline-block mt-3 rounded-full bg-parchment-card px-3 py-1 text-xs font-semibold', String(event.format)));
    if (event.description) card.append(element('span', 'block mt-3 text-sm text-espresso-soft whitespace-pre-wrap break-words', String(event.description)));
    card.addEventListener('click', () => showEvent(event, card));
    article.append(card);
    const links = element('div', 'flex flex-wrap gap-3 px-4 pb-4 text-xs font-bold text-slateNavy');
    const directions = element('a', 'underline', 'Directions ↗');
    directions.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.address)}`;
    directions.target = '_blank'; directions.rel = 'noopener noreferrer'; links.append(directions);
    if (event.source) {
      const source = element('a', 'underline', 'Official event details ↗');
      source.href = event.source; source.target = '_blank'; source.rel = 'noopener noreferrer'; links.append(source);
    }
    article.append(links); list.append(article);
    if (!selectedCard) showEvent(event, card);
  });
  if (!upcoming.length) showMap('Melbourne VIC Australia', 'Backgammon around Melbourne');
})();
