# Community events

The Events section uses an embedded Google map focused on the event selected from the list. No Maps API key or billing account is required. It does not show all events as simultaneous pins. Google controls the map embed; directions open Google Maps in a new tab.

Members submit an event using the email in the existing Members sheet. The server checks membership, stores the event privately, and emails that address an expiring, single-use confirmation link. Opening the link publishes the event. Pending/failed/expired events, emails and token hashes never appear in public event data. Event times are interpreted and displayed in Australia/Melbourne, including daylight saving; ambiguous/nonexistent changeover times are rejected.

## Deployment — backend first

1. Save a backup of the current Apps Script `Code.gs` before replacing it. The replacement in [apps-script/Code.gs](../apps-script/Code.gs) includes the existing registration, match recording and match-confirmation handlers plus event handlers.
2. Open the existing Apps Script project. Select `Code.gs`, replace its entire content with `apps-script/Code.gs`, and save. Do not add a second copy of these functions in a separate file.
3. Choose **Deploy → Manage deployments**, select the existing web app, click the pencil/edit button, select **New version**, and click **Deploy**. Keep the existing deployment URL, execution identity and access settings. The web app needs to run as its owner and be accessible to website visitors. Merely saving code does not update the deployed web app.
4. The replacement retains the existing `SCRIPT_URL`. Do not create a different deployment URL unless both that constant and `events-config.js` are updated together (also update the existing match frontend endpoint). Existing emailed match links must keep working.
5. Confirm the deployed GET response includes `eventsVersion: 1` and `events: []` alongside `matches` and `members`. Until this version is present, the event form stays disabled and does not POST to the old backend. An `Events` sheet is created with headers on the first valid member submission. If a sheet called Events already exists with different headers, stop and resolve the conflict instead of overwriting it.
6. Deploy the website files through the normal hosting workflow: `index.html`, `events.js`, and `events-config.js`. These local changes are not pushed or deployed automatically. Preserve the earlier mobile navbar change.
7. With a controlled member address and permission to send it email, submit one event, verify it is absent publicly, click its confirmation email, and confirm it appears on a refreshed event list and map. Check a second click cannot republish it. Check browser-readable POST responses on the actual website origin; an opaque `no-cors` response is not sufficient. Never switch to `no-cors` or report successful email delivery without an acknowledged backend response.

Do not post events against the old backend manually: it treated unrecognized actions as match submissions. The new backend explicitly rejects unknown actions.

## Data and behavior

GET returns `{ matches, members, eventsVersion: 1, events }`. Public event fields are `id`, `status: "confirmed"`, `title`, `venue`, `address`, `startsAt`, `endsAt`, `format`, and `description`. Times are ISO UTC strings. Past events disappear when their end time passes (on page reload).

POST uses JSON with a CORS-simple `text/plain` content type and `action: "submitEvent"`. Fields are `memberEmail`, `title`, `venue`, `address`, local-wall-clock `startsAt` and `endsAt`, `format`, `description`, and `timeZone: "Australia/Melbourne"`. Success returns `{ status: "pending_verification" }`. The response intentionally does not reveal whether an email belongs to a member. Invalid input returns `{ status: "error", error: "..." }`.

Events must start in the next 366 days, end after their start, and last no more than seven days. Confirmation expires within 24 hours or at event start, whichever is sooner. The backend deduplicates identical open submissions, allows three email requests per member per hour and 30 total per hour, and checks remaining Apps Script mail quota. Repeated requests do not automatically resend the same pending event. An ignored email expires without publishing. Inactive members cannot submit or confirm events.

The private Events sheet columns are defined in `EVENT_HEADERS_`. Confirmation tokens are stored only as SHA-256 hashes and cleared on use. Sheet writes and confirmation are serialized by a script lock. User text is escaped for HTML and protected from spreadsheet formula evaluation. Existing match-verification semantics are preserved; event tokens do not replace previously issued match links.

The email link intentionally publishes on opening to match the requested one-click flow. Some automated email link scanners may follow links; if this becomes an issue, use a landing page with an explicit confirmation button instead.

## Validation

Run `node --test tests/events-backend.test.cjs` with Node (no package installation needed). Tests mock Apps Script services and email; they do not modify Google Sheets or send real emails. They exercise membership checks, private pending data, token confirmation/expiry/reuse, email failure, rate limits, malicious text, Melbourne time handling, and existing match/member behavior.

For browser tests, run `python3 -m http.server 8000 --bind 0.0.0.0` from the repository, then `python3 tests/events-browser.py`. This optional test requires Python Playwright, Chromium at `/usr/bin/chromium`, and curl. It supplies controlled event API responses and a map iframe test double. External styling/scripts use curl's verified TLS transport because native Chromium rejects this environment's proxy certificate. It checks mobile/desktop UI, event visibility, safe text rendering, payload timezone, validation, pending acknowledgement and old-backend gating. It does not prove the live Google map embed or live email integration works.

Still required after manual Apps Script deployment: real-origin CORS validation, one controlled email confirmation, and a live Google Maps embed check. No real email, event submission, spreadsheet write, deployment or website push was performed during local development.

### Deployment observed

After the user deployed the Apps Script update, a read-only live GET returned `eventsVersion: 1`, an empty events array, two matches and seven members. An intentionally incomplete `submitEvent` request was rejected with `Membership email is required.` and `Access-Control-Allow-Origin: *`; this request cannot create an event or dispatch an email. The actual confirmation email cycle and live website deployment remain untested. Google embed hosts were added to the cloud environment draft (preserving existing domains); review/save and publication are required before this environment can validate the embed.
