# Galaxy usernames

Steven Goldberg authorised publishing the Galaxy username `goldbs` on 26 October 2026. `galaxy-profiles.js` adds it beneath his leaderboard name. Clicking the handle copies it; View profile opens the participant-supplied URL https://www.backgammongalaxy.com/play/page_profile?id=6566e056a5e9320025e57b77. Galaxy may require sign-in. The ID and username were supplied by the participant; they have not been independently verified against Galaxy data. No ratings or matches are imported.

The initial mapping is maintained by the association, matches the exact community display name case-insensitively, and decorates leaderboard rows after rendering and refresh. No email addresses, passwords, session tokens or Google Sheets changes are required. Self-service linking is not implemented. A broader rollout should identify participants by stable community ID, obtain public-display consent and use expiring email confirmation for additions, changes and removal.

Research on 26 October 2026 found an app-internal profile route using an `id` parameter, not a verified public username URL. The exact player-search endpoint referenced by the public Galaxy app returned HTTP 401 when queried without credentials for `goldbs`; no credentials were supplied and no further protected requests were attempted. Do not construct guessed profile links from usernames or claim an API integration. The participant then supplied the actual profile URL above, allowing direct linking without username lookup or credentials. Do not assume profile IDs can be derived from other participants’ usernames.

Official references:

- [Find players and add friends](https://backgammongalaxy-help.freshdesk.com/support/solutions/articles/158000470034-how-do-i-add-accept-or-remove-friends-)
- [Username rules](https://backgammongalaxy-help.freshdesk.com/support/solutions/articles/158000469987-what-are-the-rules-for-usernames-and-can-i-change-mine-)
