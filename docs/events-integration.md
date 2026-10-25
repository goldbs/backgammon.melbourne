# Association-managed events and external tournament listings

Public event submissions have been removed. Only the association maintains its hosted-event calendar. Tournaments run by other clubs appear separately and are added only after the organiser of this website approves specific sourced listings. The wording does not imply a formal affiliation or partnership with those clubs.

## Website data

`events-config.js` contains two public arrays, both currently empty:

- `associationEvents`: association-hosted events approved for publication.
- `sisterClubTournaments`: externally hosted tournaments explicitly approved for listing.

Research candidates must stay outside the public checkout, not in these arrays. The website does not import external calendars or legacy member events automatically.

Association event fields:

```js
{
  approved: true,
  host: 'association',
  title: 'Approved association event title',
  venue: 'Confirmed venue',
  address: 'Confirmed public event address',
  startsAt: 'YYYY-MM-DDTHH:mm:ss+11:00', // use the correct Melbourne offset for the event date
  endsAt: 'YYYY-MM-DDTHH:mm:ss+11:00',
  format: 'Optional format',
  description: 'Optional public information'
}
```

Use real, verified timestamps, not the placeholders above. The browser requires approval and association host, omits expired/invalid events, orders by start, and focuses the embedded Google map on the selected event. No Maps API key or billing account is needed. This schema is an example only and is not loaded as a real event.

External tournament fields:

```js
{
  approved: true,
  title: 'Approved tournament title',
  organiser: 'Actual organising club or association',
  startDate: 'YYYY-MM-DD',
  endDate: 'YYYY-MM-DD', // optional for a one-day tournament
  venue: 'Optional verified venue',
  sourceUrl: 'https://official-organiser.example/event',
  description: 'Optional verified public details'
}
```

Date-only listings do not invent start/end times. The browser omits unapproved, expired, invalid-date and unsafe-source entries. Ongoing multi-day events remain listed through their last Melbourne calendar day. Links go to the named organiser’s official information; registration and any payments are handled by that organiser.

## Required external-event approval

Before adding a real tournament, obtain an official source and confirm its title, actual organiser, future date(s), venue/location and entry details. Include any uncertainty or cancellation/update notice in the shortlist sent to the website organiser. Do not infer a future edition from a past tournament, treat an undated recurring social session as a dated tournament, or label a club a formal sister/partner without confirmation.

No real external tournament has been added in this revision. Research on 25 October 2026 was blocked: Google’s search response supplied a JavaScript challenge rather than usable results, while the environment proxy denied Bing/ANZBGF with HTTP 403 CONNECT errors. The saved draft includes research domains, but that does not establish they are active in the running machine. Retry only after publication/runtime application or another meaningful access change; do not invent a shortlist.

## Backend closure and deployment

The updated `apps-script/Code.gs` rejects every `submitEvent` POST without sending email or writing sheets. Old `verifyEvent` links return a closed notice and cannot publish. Public GET retains an empty `events` array and advertises `eventSubmissionsOpen: false` for compatibility. Existing Sheets data is preserved; legacy confirmed member events are not automatically republished. Match handling, community registration and association-membership requests remain supported.

**The owner must deploy this updated Apps Script as a new version on the existing deployment URL.** Publishing website files removes the submission UI but does not update the separately deployed Google script. Until that script is redeployed, its old public endpoint may still accept event submissions/confirmation links. Do not claim live server-side closure based only on the frontend removal.

The source update also removes the event-submission dialog, handlers and prompts from `index.html`/`events.js`, and updates the association page’s community-participation wording. Website changes are deployed through GitHub main/Cloudflare; Apps Script remains a separate deployment.

## Checks

`node --test tests/events-backend.test.cjs` exercises server rejection, old-link closure, preservation of legacy records, and existing membership/match behavior with fake Apps Script services. No live writes or emails are performed.

With the local static server running, `python3 tests/events-browser.py` checks mobile/desktop association-only rendering, absence of event submission controls and POSTs, external listing approval/date/source filtering, safe text, and empty calendars. All event examples exist only inside test fixtures, not in public listing data. Native Chromium’s proxy trust limitation is handled by certificate-verified curl transport for external styling/scripts; the map itself is a test double.
