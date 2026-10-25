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
  const mapPanel = document.getElementById('eventMapPanel');
  const hideMap = document.getElementById('hideEventMap');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let selectedCard = null;
  hideMap?.addEventListener('click', () => {
    mapPanel.hidden = true;
    mapContainer.replaceChildren();
    document.getElementById('selectedEventDetails').hidden = true;
    if (selectedCard) {
      selectedCard.setAttribute('aria-pressed', 'false');
      selectedCard.setAttribute('aria-expanded', 'false');
      selectedCard.focus({ preventScroll: true });
      selectedCard.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    }
    selectedCard = null;
  });

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
      selectedCard.setAttribute('aria-expanded', 'false');
    }
    selectedCard = card;
    card.setAttribute('aria-pressed', 'true');
    card.setAttribute('aria-expanded', 'true');
    const opening = mapPanel && mapPanel.hidden;
    if (mapPanel) mapPanel.hidden = false;
    const details = document.getElementById('selectedEventDetails');
    const description = document.getElementById('selectedEventDescription');
    if (details && description) {
      details.hidden = false;
      description.replaceChildren();
      description.append(element('p', '', `${event.title} · ${event.organiser}`));
      if (event.schedule) description.append(element('p', '', event.schedule));
      description.append(element('p', '', `${event.venue || ''} · ${event.address}`));
      if (event.description) description.append(element('p', '', String(event.description)));
    }
    showMap(event.address, `${event.title} — ${event.venue || event.address}`);
    if (opening) requestAnimationFrame(() => mapPanel.scrollIntoView({ block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth' }));
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

  const clockFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  function minutes(time) {
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
  }
  function nextOccurrence(rule) {
    const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (!rule || !Number.isInteger(rule.weekday) || rule.weekday < 0 || rule.weekday > 6 ||
        !timePattern.test(rule.startTime) || (rule.endTime && (!timePattern.test(rule.endTime) || minutes(rule.endTime) <= minutes(rule.startTime))) ||
        (rule.weeksOfMonth && (!Array.isArray(rule.weeksOfMonth) || !rule.weeksOfMonth.length || rule.weeksOfMonth.some(n => !Number.isInteger(n) || n < 1 || n > 5)))) return null;
    const now = new Date();
    const today = dayFormat.format(now);
    const date = calendarDate(today);
    for (let i = 0; i < 70; i++, date.setUTCDate(date.getUTCDate() + 1)) {
      const day = date.toISOString().slice(0, 10);
      if (date.getUTCDay() !== rule.weekday ||
          (rule.weeksOfMonth && !rule.weeksOfMonth.includes(Math.ceil(date.getUTCDate() / 7))) ||
          (Array.isArray(rule.excludeDates) && rule.excludeDates.includes(day))) continue;
      // Retain an ongoing session when its published end time is known.
      if (day === today && minutes(clockFormat.format(now)) >= minutes(rule.endTime || rule.startTime)) continue;
      return day;
    }
    return null;
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
      sortTime: minutes(clockFormat.format(new Date(event.startsAt))), source: safeSource(event.sourceUrl)
    }));

  const today = dayFormat.format(new Date());
  const otherClubs = (Array.isArray(config.sisterClubTournaments) ? config.sisterClubTournaments : [])
    .map(event => {
      if (!event || !event.recurrence) return event;
      const nextDate = nextOccurrence(event.recurrence);
      return nextDate ? { ...event, startDate: nextDate, endDate: nextDate } : null;
    })
    .filter(event => event && event.approved === true && typeof event.title === 'string' && event.title.trim() &&
      typeof event.organiser === 'string' && event.organiser.trim() && hasLocation(event) &&
      calendarDate(event.startDate) && calendarDate(event.endDate || event.startDate) &&
      (event.endDate || event.startDate) >= event.startDate &&
      (event.endDate || event.startDate) >= today && safeSource(event.sourceUrl))
    .map(event => ({ ...event,
      dateLabel: (event.recurrence ? 'Next: ' : '') + dateFormat.format(calendarDate(event.startDate)) +
        (event.endDate && event.endDate !== event.startDate
          ? ` – ${dateFormat.format(calendarDate(event.endDate))}` : ''),
      endLabel: '', sortDate: event.startDate, sortTime: event.recurrence ? minutes(event.recurrence.startTime) : 0, source: safeSource(event.sourceUrl)
    }));

  // One approved calendar: MBA events and other clubs share ordering and map selection.
  // Date-only tournaments retain their published calendar dates; no time is invented.
  const upcoming = [...association, ...otherClubs].sort((a, b) =>
    a.sortDate.localeCompare(b.sortDate) || a.sortTime - b.sortTime || a.title.localeCompare(b.title));
  status.textContent = upcoming.length
    ? `${upcoming.length} upcoming ${upcoming.length === 1 ? 'event' : 'events'} · Times shown in Melbourne time`
    : 'No upcoming events listed. Check back soon.';

  upcoming.forEach(event => {
    const article = element('article', 'event-choice');
    const card = element('button', 'event-select');
    card.type = 'button';
    card.setAttribute('aria-pressed', 'false');
    card.setAttribute('aria-expanded', 'false');
    card.setAttribute('aria-controls', 'eventMapPanel');
    card.setAttribute('aria-label', `Show ${event.title} on the map`);
    card.append(element('span', 'event-date', event.dateLabel.replace(/^Next: /, '')));
    card.append(element('span', 'event-title', event.title));
    card.append(element('span', 'event-organiser', `Hosted by ${event.organiser}`));
    if (event.shortSchedule || event.schedule) card.append(element('span', 'event-schedule', String(event.shortSchedule || event.schedule)));
    if (event.endLabel) card.append(element('span', 'event-schedule', event.endLabel));
    card.append(element('span', 'event-map-action', 'View venue map →'));
    card.addEventListener('click', () => showEvent(event, card));
    article.append(card);
    const links = element('div', 'event-links');
    const directions = element('a', 'underline', 'Directions ↗');
    directions.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(event.address)}`;
    directions.target = '_blank'; directions.rel = 'noopener noreferrer'; links.append(directions);
    if (event.source) {
      const source = element('a', 'underline', 'Official event details ↗');
      source.href = event.source; source.target = '_blank'; source.rel = 'noopener noreferrer'; links.append(source);
    }
    article.append(links); list.append(article);

  });

})();
