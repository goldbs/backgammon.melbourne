# Join MBA: community participation and association membership

The existing Join MBA navbar action now opens a choice:

- **Community only (free):** registers website participation, not paid membership or voting rights.
- **Association membership ($100/calendar year):** also registers community participation, records the requester’s support for the purposes, rules version/agreement, electronic-signature intent, notice address, and age category. The proposed CAV rules are linked. While preparing to incorporate, this is explicitly an expression of interest, not a formal admission.

The association page deep-links to the choices using `index.html?join=community` and `index.html?join=association`. The association page itself is linked from the homepage footer only.

## Fee calculation

The joining month and all later months of that calendar year are charged: `500 × round((10000 × (13 − month) / 12) / 500)` cents. Monthly quotes from January through December are $100, $90, $85, $75, $65, $60, $50, $40, $35, $25, $15 and $10. These are proposed fixed joining-year amounts under CAV model rule 12(3)(c), based on remaining months but rounded to the nearest $5, not exact pro-rata subscriptions. The association must approve the schedule and the AGM fee-setting process must follow rule 12. Renewal is 1 January the following year. Both display and server quote use Australia/Melbourne, including month/year boundary behavior. The server ignores client-provided amount/payment/admission fields. No funds are collected by the website. A request-date quote is an estimate for joining in that month, not an assertion that formal membership has begun. If committee approval and the actual commencement date fall in a later month, the treasurer must reconcile the fee against that month and arrange any adjustment before finalising membership; this reconciliation is manual.

## Current state and deployment

The code is local; no live registration, application, email, payment or admission was created during development. The previously deployed Apps Script supports community registration and events but not the new registration capability yet.

Deploy the complete updated `apps-script/Code.gs` to the **existing** Apps Script deployment as a new version before deploying the website changes. Keep its existing deployment URL. As with the event deployment, save code first, then Deploy → Manage deployments → Edit → New version → Deploy. The public GET must now include `registration.version: 1`. The website checks this capability before allowing association requests, and checks again immediately before posting. It does not silently treat an old backend’s community success response as a received association application.

Website files required for this change are `index.html`, `association.html`, `membership.js`, and the existing `docs/` rules references. Keep the existing events files and earlier mobile-navbar change. Merely publishing the cloud environment does not deploy the website.

## Backend configuration

`MEMBERSHIP_SETTINGS_` deliberately defaults to:

- `applicationsOpen: false`
- `rulesAdopted: false`
- `rulesVersion: "mba-model-rules-proposed-2026-12-01-v1"`
- `rulesUrl`: the proposed completed draft URL (`docs/proposed-association-rules.html`)
- `bankAccount: null`

In this state, the association path records `preincorporation_interest`, includes free community participation, and says **not to deposit money**. It must not describe acceptance of a draft template as acceptance of already adopted association rules.

After the founding/adoption process is complete, publish the completed adopted rules, give them a distinct `rulesVersion` and stable `rulesUrl`, and set `rulesAdopted` and `applicationsOpen` to true through a reviewed code update. With both flags true, new signed requests are `pending_committee`. Previous interest can become a formal pending application only through a fresh submission/consent under the current rules; it is not silently converted.

Once supplied and confirmed by the organiser, set `bankAccount` to the public transfer details `{ accountName, bsb, accountNumber }`. Do not invent details. The backend publishes only these fields from the object, and incomplete details are treated as unavailable. Do not place credentials, online banking login details, or private keys in this configuration. A new submission never produces a deposit request. Only a previously recorded `approved_awaiting_payment` application with a valid actual committee-resolution date, formally open applications and complete bank details can show payment instructions, including the authoritative quoted amount and reference. The secretary’s written outcome/payment request is normally handled manually after the committee decision. Treat the older draft `pending_admission` state as pending committee decision. Existing admitted requests do not prompt another payment.

## Private sheets and administration

The existing `Members` sheet continues to represent **community participation**, despite its legacy name. `Active` in that sheet does not prove paid membership or a right to vote. Existing registrations are not overwritten/reactivated by a new request.

The new `MembershipApplications` sheet is created on first valid association request and records:

`ReceivedAt, ApplicationID, MembershipYear, FullName, Email, Phone, NoticeAddress, AgeCategory, RulesVersion, RulesAgreement, ElectronicSignature, SignatureAgreement, QuotedFeeCents, JoiningMonth, Status, PaymentReference, PaymentReceivedAt, CommitteeResolutionDate, AdmittedAt`.

A repeated pending/admitted request retains the existing record/reference and does not overwrite its payment or committee fields. A repeated pre-incorporation request updates its expression-of-interest details/quote/consent, preserving the reference. No public feed returns this sheet’s addresses, application details, agreements, payment references or payment/admission fields. Text is protected against spreadsheet formula evaluation.

Administrative approval is deliberately manual in the private sheet; no unauthenticated endpoint can set admission, approval or payment status. The treasurer must reconcile actual payment. The committee must decide first by minuted resolution; Steven sends the written outcome and, if accepted, requests payment. Daniel confirms receipt, then Steven records commencement once both conditions are met and maintains the formal member register required by CAV (including commencement date and associate status). Application submission, typed name/signature intent, community registration, or a bank transfer alone does not satisfy all admission/voting requirements. The website currently provides no online voting or automated renewal system. A rules checkbox and typed-name intent record do not independently prove identity; verify disputed applications through committee procedures.

Formal membership administration and the eventual adopted rules determine the commencement date; do not derive voting rights from the community row’s timestamp or expression-of-interest date. Follow the model’s more-than-10-business-day qualifying period, associate-member restrictions and subscription/suspension provisions.

## Checks

`node --test tests/events-backend.test.cjs` exercises membership and existing event/match flows using fake Apps Script services. It includes all monthly amounts, Melbourne month/year boundaries, private consent records, duplicate requests, old community signup compatibility, inactive users, pre-incorporation-to-application transition, bank-detail gating, and protection of admission/payment fields.

With the local static server running, `python3 tests/membership-browser.py` uses Playwright/Chromium and controlled API/bank responses. It checks both choices on mobile/desktop, consent validation, error acknowledgement, payment instructions only when enabled, pending status, deep links and old-backend gating. External styling/scripts use certificate-verified curl transport. These tests do not prove live deployment or bank reconciliation.

## Founding meeting and process decision

The organiser selected the unmodified CAV model-rule approval process after considering automatic admission. Approval therefore precedes the payment request. Draft agenda, blank minutes, register template and unsent notice templates are in `/workspace/association-meeting-pack/`, outside the public site because its agenda contains a founders-only location/calendar link. The public page lists 1 December 2026 at 8:00 pm Melbourne time and attendance limited to seven founders.
