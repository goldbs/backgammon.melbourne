# Committee email setup options

The organiser uses VentraIP, Cloudflare and GitHub. Exact domain DNS/MX state and included VentraIP mail services have not been verified: DNS queries were refused in this execution environment and the Cloudflare documentation request returned 403. No DNS settings, aliases, mailboxes or application senders have been changed.

Proposed role addresses based on the current officers:

- president@backgammon.melbourne → Eric Berkhinfand
- vicepresident@backgammon.melbourne → Bryce Adams
- secretary@backgammon.melbourne → Steven Goldberg
- treasurer@backgammon.melbourne → Daniel Wroby
- contact@backgammon.melbourne → secretary or a designated contact inbox

The website continues to use the existing contact@ address. Do not replace it with unconfigured role addresses before testing delivery.

## Receiving only: Cloudflare Email Routing

If Cloudflare is the authoritative DNS host, its Email Routing service can provide incoming aliases forwarded to verified existing inboxes. In the Cloudflare dashboard, open the domain, locate Email / Email Routing, verify the destination inboxes, and create each custom address mapped to the corresponding officer. Follow the service’s generated DNS setup instructions; confirm the existing mail arrangement before replacing MX records. Record any existing configuration so a deliberate migration preserves delivery. Do not publish guessed MX/SPF values or create conflicting SPF TXT records.

Cloudflare Email Routing is incoming forwarding, not a conventional mailbox or outbound SMTP service. Replies from personal inboxes normally identify the personal address unless a separate authenticated sending service is configured. Dashboard labels and current plan availability should be checked against the live UI and official guide: https://developers.cloudflare.com/email-routing/.

## Receiving and sending as association officers

First check whether the existing VentraIP service includes email accounts. Domain registration/DNS management by itself does not establish mailbox availability. If mail hosting is included, create role mailboxes or aliases in that mail service and use its exact MX, SPF and DKIM records in the authoritative DNS panel. Otherwise choose a separate custom-domain mail provider; costs and free-tier limitations need current verification. GitHub website hosting does not provide mailboxes or SMTP.

A free incoming forwarder alone does not solve outgoing role-address replies. When an actual sending service is chosen, authenticate the domain with that provider’s documented records and test both directions. Personal destinations should remain private configuration, not website content. Role addresses can outlast individual office holders by changing their destinations/access when officers change.

Apps Script verification emails currently use MailApp under the deployment owner’s Google account. Adding DNS aliases does not automatically change that sender. Changing the application’s sending identity requires a separately verified/supported sending setup; do not spoof a role address.
