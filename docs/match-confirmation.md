# Independent confirmation of match results

New match submissions use an `m2_` ID and remain Pending until both registered players independently approve the exact submitted result. Historical rows explicitly marked Confirmed with legacy IDs remain published. Blank, Pending, Disputed and EmailFailed rows are not published. Old tokenless email links cannot change records; legacy pending matches must be resubmitted under the new process.

## Submission and publication

Both names must resolve to exactly one active Members record, with valid, distinct registered emails. Guests and shared-email matches are rejected before a match is written. Scores must be integers 0–99 with a winner, and the winning score must equal the match length. Optional PR must be finite and non-negative; zero is retained. Casual and Tournament are the supported formats.

Each player receives a different private, random token. Only SHA-256 hashes are stored, in a separate MatchConfirmations sheet; the existing match columns stay unchanged. Links expire after seven days. GET opens a review page without recording a decision, preventing routine email-link scanners from approving results. A deliberate form POST records the recipient’s confirmation or dispute. Confirming repeatedly never counts for the other player. Either player may dispute, including after both have confirmed while the link is valid; a dispute removes the result from the public feed and cannot be overwritten by another confirmation. No automatic correction/override or reminder emails are implemented.

Tokens are bound to the match ID, player slot and a digest of the names, scores, PRs, length and format. Editing these fields invalidates approvals and withholds a new-format result. Do not edit an approved m2_ result in place expecting old approvals to remain valid; contact the committee and arrange a corrected submission. A confirmed result remains public after link expiry; expiry prevents new actions rather than erasing historical approvals.

A script lock serialises submissions and decisions. Failed email delivery blocks publication, including when only one email was sent. A quota check requires capacity for both emails. Client-generated request IDs make same-request retries idempotent; they do not deduplicate distinct matches with identical scores. If delivery fails, contact the committee before resubmitting. The app does not send a success message unless the backend explicitly acknowledges Pending with two confirmations required.

## Deployment and existing records

The clasp workflow deploys the backend; Cloudflare deploys the website separately. The public feed advertises `matchConfirmationVersion: 2`, and the new form refuses submission until that capability is loaded. The deployment's final GET check requires this version. No production test match, registration or email is sent by development checks. The private proof sheet is created lazily on the first valid production match submission, not during deployment.

Existing published results are preserved rather than retrospectively re-confirmed. Existing pending results created with shared old links cannot be approved by those links; re-enter them for separate player confirmations. No live historical rows are modified during deployment.

## Validation

`node --test tests/events-backend.test.cjs tools/clasp/deploy.test.mjs` tests token isolation, repeated clicks, two-player gating, disputes, invalid/expired/cross-match links, payload edits, delivery failures, old links, historical publication and idempotent retries, alongside existing membership/event behavior. `python tests/match-confirmation-browser.py` checks form feedback, successful Pending receipts, error/network handling, retry IDs, capability gating and logo display at mobile/desktop widths using mocks only.
