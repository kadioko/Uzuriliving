# Uzuri Living Email Setup

Uzuri Living uses two email services on `uzuriliving.com`:

- **Mailtrap** handles outbound email from the app, such as transactional messages.
- **ImprovMX** handles inbound forwarding, such as people emailing `support@uzuriliving.com`.

These do not conflict because outbound sending and inbound receiving use different DNS record types and different runtime paths.

## DNS Records

DNS is managed in Vercel because `uzuriliving.com` is a Vercel domain.

### Inbound: ImprovMX

Keep these MX records on the root domain:

| Type | Name | Value | Priority |
| --- | --- | --- | --- |
| `MX` | `@` | `mx1.improvmx.com` | `10` |
| `MX` | `@` | `mx2.improvmx.com` | `20` |

### Outbound: Mailtrap

Keep the Mailtrap DKIM CNAME records from the Mailtrap dashboard. Current expected selectors:

| Type | Name | Value |
| --- | --- | --- |
| `CNAME` | `rwmt1._domainkey` | `rwmt1.dkim.smtp.mailtrap.live` |
| `CNAME` | `rwmt2._domainkey` | `rwmt2.dkim.smtp.mailtrap.live` |

Keep DMARC on `_dmarc.uzuriliving.com`. Start with `p=none` while monitoring reports, then move to stricter policy only after outbound sending is stable.

### SPF: One Combined Record Only

SPF must be a single TXT record on the root domain. Do not create separate SPF TXT records for Mailtrap and ImprovMX.

Recommended value:

```text
v=spf1 include:spf.improvmx.com include:_spf.mailtrap.io ~all
```

This keeps ImprovMX authorized for its forwarding flow and Mailtrap authorized for outbound app email.

## Supabase Environment

Set these on the backend service in Supabase:

```text
MAIL_FROM="Uzuri Living <noreply@uzuriliving.com>"
MAIL_REPLY_TO=support@uzuriliving.com
MAILTRAP_API_TOKEN=<from Mailtrap>
MAILTRAP_SMTP_HOST=live.smtp.mailtrap.io
MAILTRAP_SMTP_PORT=587
MAILTRAP_SMTP_USER=<from Mailtrap>
MAILTRAP_SMTP_PASS=<from Mailtrap>
SUPPORT_EMAIL=support@uzuriliving.com
```

Use either Mailtrap API credentials or SMTP credentials, depending on the implementation path used by the app feature.

## Verification

Run:

```bash
cd backend
npm run email:dns-check
```

The checker verifies:

- ImprovMX MX records exist.
- Exactly one SPF record exists.
- SPF includes both `spf.improvmx.com` and `_spf.mailtrap.io`.
- Mailtrap DKIM CNAME records exist.
- DMARC exists.

## Current Operational Rule

Use:

- `support@uzuriliving.com` for public contact and replies.
- `noreply@uzuriliving.com` for automated app mail.
- ImprovMX dashboard for inbound forwarding destinations.
- Mailtrap dashboard for outbound sending health, logs, and domain compliance.
