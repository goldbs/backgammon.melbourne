# Historical archive and Bliss analysis links

The archive groups each match into two player rows, with PR and score aligned on the right. Date, format and match length (when supplied) appear above the players. Missing/invalid PR renders as a dash; valid PR, including zero, uses two decimals and contributes to averages.

PR-recorded matches display `Bliss analysis · Link can be added` when no URL is supplied. This is informational text, not an inactive link or a claim that analysis is available. Matches without PR omit the analysis row; the PR dashes indicate missing values. The table is centred at a maximum width of 700px, with a Powered by Bliss logo treatment below it.

The renderer accepts an optional `blissAnalysisUrl` in each match object. A valid HTTPS URL without embedded credentials displays `View analysis on Bliss`; unsafe URLs are omitted. No real Bliss URL or hostname has been assumed, and no example/test URL is published in listing data.

Current scope is the archive layout and a visible analysis-link slot. The existing Apps Script feed does not yet return `blissAnalysisUrl`, and the match form does not accept it. Before wiring real links through storage and the public feed, obtain the partner's actual public share-link format, confirm domain validation and decide whether the committee or the person recording a match adds it. Keep private/editor/share-token URLs out of public records. No Apps Script or sheet changes were made for this layout update.

With a local static server, `python tests/archive-browser.py` checks no PR, one/both PRs, zero PR/scores, formatting, averages, optional analysis links, safe text/URLs and mobile overflow using fixtures only. No live match submissions, records or email.
