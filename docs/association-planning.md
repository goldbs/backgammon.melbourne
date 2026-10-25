# Association page and incorporation preparation

`association.html` is a draft page for a not-yet-incorporated association. It is linked from the homepage footer only. The earlier inaccurate incorporation claim in the homepage footer is corrected.

## Confirmed by the founding organiser

- Intended name: Melbourne Backgammon Association; legal registration and adopted name are not yet confirmed.
- Intention to adopt Consumer Affairs Victoria model rules at the founding meeting.
- Free website users are community participants, separate from formal association membership. Leaderboard participation, match submission and event browsing remain available; members cannot publish events.
- Proposed association subscription: AUD $100 per calendar year, renewal on 1 January. Admission and voting must follow the eventually adopted rules, not payment or website signup alone.
- President: Eric Berkhinfand. Vice president: Bryce Adams. Secretary: Steven Goldberg. Treasurer: Daniel Wroby.
- Other founding committee members: Greg Sacks, Daniel Kobrin, Yona Takac.
- All formal appointments and adoption decisions remain for the founding process.

## CAV source reviewed

The organiser supplied `Model rules for an incorporated association.docx` (88,154 bytes). The document references the Associations Incorporation Reform Regulations 2023. A byte-identical source copy is served at `docs/cav-model-rules-template.docx`; an escaped, complete plain-text transcription of the operative template (excluding its cover/table of contents) is at `docs/cav-model-rules-template.html`. The placeholders remain unchanged. These are explicitly unfilled, unadopted templates, not the association’s constitution.

The page now summarises the supplied source with rule references:

- Rules 9–11: signed application (electronic permitted), committee resolution/notification, membership commencement once approval and any applicable joining fee requirements are met. Website signup is distinct.
- Rules 12–14 and 17: more than 10 business days before voting, no vote for associates, under-15 members are associates, rights suspended immediately upon annual subscription falling overdue, deemed resignation once more than 12 months in arrears.
- Rule 49: committee office requires age 18+ and voting eligibility. Eligible members 15–17 may vote; do not incorrectly label all under-18s non-voting associates.
- Rules 30–39: first AGM within 18 months after incorporation, subsequent AGMs within five months of financial-year end; 14/21-day general meeting notice, 10% eligible-voter quorum, ordinary majority/special 75%-of-voters distinction, proxies and members’ special-meeting request rights.
- Rules 19–29: impartial discipline, 14–28-day notice, no disciplinary fines, seven-day appeal notification to secretary, separate appeal subcommittee convened within 21 days; grievance discussion within 14 days, then next 10 days to notify/request mediation and attempt good-faith settlement.
- Rules 44 and 52 provide separate secretary and treasurer offices and elections. The organiser has resolved the earlier dual-office proposal: Steven Goldberg is secretary, Daniel Wroby treasurer, and Bryce Adams vice president.
- Rules 58, 63–66: four committee meetings annually, majority quorum, conflicts register and minutes.
- Rules 18, 70, 75: member register inspection rights subject to statutory personal-information restrictions, records-access exceptions, free rules and seven-year financial-record retention. Do not promise formal member-register details are inaccessible to other members.

## Additional decisions confirmed by organiser

- Proposed financial year: 1 January–31 December; ordinary post-first AGM deadline consequently 31 May.
- Proposed subscription: $100 per calendar year, 1 January renewal, pro-rata for members joining partway through the year. Monthly proration includes the joining month and all remaining calendar months; round the total to the nearest $5, as a proposed fixed joining-year schedule under rule 12(3)(c) rather than exact pro-rata amounts. The calculation is implemented in membership.js for display and independently in Apps Script as the authoritative quote, using Melbourne time. Subscription arrangements must still be resolved through the association’s founding/adopted-rule process, including future AGM fee-setting requirements.

## Remaining source and incorporation work

- The organiser selected the ANZBGF rules instead of the earlier WBA reference and supplied `Tournament-Handbook-v.1-1.6.24.pdf` (451,026 bytes). The handbook identifies itself as ANZBGF Tournament Handbook v.1, 1/6/24. Its live tournament rules, code of ethics, player etiquette and spectator etiquette were read directly from the attachment. The page identifies the edition as version 1, 1 June 2024; it does not claim it is the newest available edition.
- The supplied PDF is served unchanged at `docs/anzbgf-tournament-handbook-v1-2024-06-01.pdf`, with read/download links. The previous WBA/WBGF proposal is removed from the association page.
- The page summarises Legal Moves as the default (§1.1/4.2(iii)), clock settings (§3.5), Crawford and money-game exclusions (§4.4), preservation of the position and director/appeal procedures (§5), and player/spectator etiquette (§1.2/1.6). It distinguishes the federation ethics scope and tournament procedures from association membership discipline under CAV rules. Chouette conditions require separate event arrangements.
- The proposed purposes now repeat the four homepage “that’s why we play” tiles verbatim: Grow the Game, Welcome New Players, Elevate Play and Compete. The founding meeting is confirmed for 1 December 2026 at 8:00 pm Melbourne time (AEDT), limited to the seven founders with in-person/online participation. Steven chairs and Daniel takes minutes. Location/calendar details are held in the private draft pack outside the public checkout. Do not invent a registered name, incorporation number, adoption date or election outcome.
- The earlier combined secretary/treasurer question is resolved by the organiser’s new officer assignments.

Website changes remain local and unpublished. Browser layout checks use certificate-verified curl transport for external assets because of Chromium’s proxy trust issue. They are separate from verification of legal content and official external links.

## Chouette reference supplied

The organiser supplied https://www.bkgm.com/variants/Chouette-ABA.html. The association page now links this as a separate chouette reference. Direct access returned HTTP 403, so no assertions about that page’s exact rules, publisher attribution or edition have been made. Do not treat the general list of session arrangements (cube, consultation, rotation, participation) as a summary of the unread source. The bkgm.com and www.bkgm.com domains were added to the existing environment draft; review/save and publication are needed before access can be retried. Alternatively, obtain the page text/PDF from the organiser.

## Integrated Join MBA flow

See `docs/membership-integration.md`. Both options use the existing Join MBA button. Free community registration remains separate from paid association admission. An association request includes community participation automatically, records versioned rules agreement/signature intent privately, and uses server-calculated monthly proration. Applications currently remain pre-incorporation expressions of interest. Bank details are TBC; no deposit instruction is issued. The updated Apps Script must be deployed before the new association choice is available; it is gated using the public registration capability, while community registration works with the earlier backend.

## Founding process confirmed

The organiser confirmed the proposed legal name Melbourne Backgammon Association Inc. and chose to retain CAV model-rule committee approval under rule 10. The proposed sequence is approval, then payment request, then commencement once receipt is confirmed. Founders admitted in December pay $10 for 2026 and renew at $100 on 1 January 2027. The private preparation pack is `/workspace/association-meeting-pack/`. No meeting resolutions, incorporation, application decisions, invitations or notices have been issued by the assistant.

A completed proposed rules copy is now available at `docs/proposed-association-rules.docx` and `.html`, clearly labelled unadopted. Completion was verified to change only the three operative template paragraphs for rules 1 (proposed name), 2 (four agreed purposes) and 3 (31 December year end); all other DOCX package files and operative paragraphs remain unchanged. The blank source template remains available separately. Current proposed consent reference is `mba-model-rules-proposed-2026-12-01-v1`; formal applications still require a fresh adopted-rules version after the meeting.

## Public founding-meeting documents

The organiser authorised publishing meeting documents on the association page, with attendance details shared directly with founders. The `#founding-documents` section links public-safe HTML copies of the agenda, membership administration process and blank minutes, plus the completed proposed rules. Each of the three meeting documents has print/save-as-PDF controls and a downloadable plain-text copy. Their shared CSS is local and includes mobile/print layouts.

Public files: `docs/founding-meeting-agenda.html` / `.txt`, `docs/membership-administration.html` / `.txt`, `docs/founding-meeting-minutes.html` / `.txt`, and `docs/meeting-documents.css`. These were prepared as public reading copies without private attendance details or backend implementation notes. The original private pack remains outside the repository. The street address, calendar/joining link and personal forwarding destination are not published. The footer-only link to the association page is unchanged.

Link/anchor/download checks and mobile/desktop print controls were validated locally. These source changes are not a website deployment.

## Association-only event publishing

The organiser withdrew public/member event hosting and submissions. The website now has one read-only calendar combining association-hosted events and approved tournaments hosted by other clubs. The external list now contains two recurring club sessions (Monday and Thursday), following removal of the Sunday listing; the association-hosted array remains empty. Apps Script source rejects submission POSTs and legacy confirmation links, but the owner must redeploy that source for server-side closure. No external event may be added until the organiser explicitly approves it. See `docs/events-integration.md`.
