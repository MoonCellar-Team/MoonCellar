# Mail

How MoonCellar sends mail, and what has to exist outside the repository for it to reach an
Inbox. Everything here is about letters the product sends: there are no mailboxes, no IMAP and
no inbound delivery.

The letters themselves are built in `apps/api/src/module/mail` and follow
[Branding](./branding).

## What sends

| Piece                      | Value                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API module                 | `apps/api/src/module/mail` — `nodemailer` over SMTP                                                                                                           |
| SMTP server                | the `mail` service of `infra/docker-compose.prod.yml`, `docker.io/boky/postfix:5.2.1`                                                                         |
| Address inside the network | `mail:587`, submission. No port is published: only containers on the `mooncellar` network can reach it                                                        |
| Sender                     | `MoonCellar <noreply@mooncellar.space>` (`SMTP_FROM`)                                                                                                         |
| Signing                    | rspamd inside the same container, signing with the key from `MAIL_DKIM_DIR` — selector `mail`, domain `mooncellar.space`                                       |
| Transport                  | Postfix delivers straight to the recipient's MX. The host's outbound port 25 is open, which this setup depends on — see [Outbound port 25](#outbound-port-25) |

`boky/postfix` is a Postfix built for application mail: it takes messages on 587 from trusted
networks, signs them, and delivers them. It has no user accounts, no Dovecot and no spam filter,
because nothing ever connects to it from the internet.

**The container is not a mail server for people.** It has no MX record, no mailbox and no
inbound port, so nobody can write to `noreply@mooncellar.space`. Do not publish port 25 or add
an MX record without building a real inbound server behind it.

## Variables

The API side (see [Deploy variables](./deploy-env)). The deploy appends the four non-secret
values to `apps/api/.env` before the image build — **only when `HOST_ENV_API` does not set
`SMTP_HOST` itself**, so a relay configured there wins — which means production needs nothing
in the secret unless a different sender or a relay login is wanted:

| Variable                     | Default                                 | Description                                                                                                                                                                                                        |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SMTP_HOST`                  | **none**                                | The mail container, `mail`. **Unset means the module is off**: `POST /mail/test` answers 503 and nothing else can send either. There is deliberately no default, so a laptop running `dev:api` never tries to send |
| `SMTP_PORT`                  | `587`                                   | Submission port of the container                                                                                                                                                                                   |
| `SMTP_SECURE`                | `false`                                 | `true` for implicit TLS (port 465). The container speaks plain submission with `smtpd_tls_security_level=may`, so this stays `false`                                                                               |
| `SMTP_USER`, `SMTP_PASSWORD` | none                                    | Only for a relay that needs a login. The internal container allows the Docker networks (`POSTFIX_mynetworks`) and needs neither                                                                                    |
| `SMTP_FROM`                  | `MoonCellar <noreply@mooncellar.space>` | The `From` header, and the domain SPF and DMARC are checked against. **Its domain must stay `mooncellar.space`**                                                                                                   |
| `SMTP_REPLY_TO`              | none                                    | Optional `Reply-To`. Leave it empty while nothing reads the replies                                                                                                                                                |

The infrastructure side (`HOST_ENV_INFRA`):

| Variable        | Description                                                                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MAIL_DKIM_DIR` | Host directory bind-mounted as `/etc/opendkim/keys` — `/opt/mooncellar/mail-dkim`, which is the default in the compose file. The mount sets `create_host_path: false`, so the directory and its key must exist before the first infra deploy or compose refuses to start |

## The DKIM key

The key is generated once on the host and never enters the repository. `infra/mail/generate-dkim.sh`
does the whole job and prints the DNS record to publish:

```bash
ssh root@31.57.201.233
mkdir -p /opt/mooncellar/mail-dkim
/opt/mooncellar/infra/mail/generate-dkim.sh mooncellar.space mail /opt/mooncellar/mail-dkim
```

It writes `mooncellar.space.private` (owned by the container's `opendkim` user, mode `640`) and
`mooncellar.space.public`, prints the `mail._domainkey` record, and **refuses to overwrite an
existing key**. That refusal is the point: the private key and the published public key are one
pair, and generating a second key under the same selector breaks every letter signed with the
first until DNS catches up.

**The image signs with rspamd, which imports whatever is in `/etc/opendkim/keys` when it starts**
and copies it into its own directory, so the letters go out signed `relaxed/relaxed` as
`d=mooncellar.space; s=mail`. The private key is still written into the OpenDKIM directory, and
the script sets it to `640` owned by `opendkim` (uid `101`, gid `104`), because that is the shape
the image expects if the backend is ever switched to OpenDKIM; as root-imported keys it would
work either way, but a key the signing process cannot read fails silently — no error at send
time, nothing in the API log, and only SPF left to carry the letter past DMARC.

## DNS

The zone of `mooncellar.space` is served by SpaceWeb (`ns1.spaceweb.ru`). Four records plus one
reverse record are what make a letter land in the Inbox rather than in spam.

| Record                             | Type  | Value                                              | Why                                                                                                                            |
| ---------------------------------- | ----- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `mail.mooncellar.space`            | `A`   | `31.57.201.233`                                    | The name Postfix announces as `myhostname`; it must resolve to the address the letter is sent from                             |
| `31.57.201.233`                    | `PTR` | `mail.mooncellar.space`                            | Forward-confirmed reverse DNS. Receivers score a sender whose address has no name, or a name that does not point back, as spam |
| `mooncellar.space`                 | `TXT` | `v=spf1 a:mail.mooncellar.space -all`              | SPF. `a:` follows the `A` record above, so moving the host means changing one record instead of two                            |
| `mail._domainkey.mooncellar.space` | `TXT` | `v=DKIM1; k=rsa; p=…`                              | The public half of the key from the previous section. `p=` is printed by the script                                            |
| `_dmarc.mooncellar.space`          | `TXT` | `v=DMARC1; p=quarantine; adkim=s; aspf=s; pct=100` | DMARC. Strict alignment on both, because everything is sent from `mooncellar.space` itself                                     |

Notes that matter:

- **The PTR record is set in the provider's panel for the IP, not in the zone.** The reverse zone
  of `31.in-addr.arpa` belongs to the network's operator, so this is a support request or a
  setting next to the VPS, not a DNS entry. It cannot be skipped: without it Gmail and Outlook
  sort the letter into spam however good the other three records are.
- **`-all`, not `~all`.** Nothing else sends as `mooncellar.space`, so a receiver may reject
  anything that does. A relay added later must go into the same record in the same change.
- **DMARC starts at `p=quarantine`.** Move it to `p=reject` once a week of reports shows every
  legitimate letter passing with the aligned DKIM signature. `rua` is left out on purpose: a
  report address on this domain cannot receive anything (there is no inbound mail), so pointing
  `rua` at it would silently drop every report. Add `rua=mailto:<an address that exists>` first
  if the reports are wanted.
- **SPF and DKIM both align on `mooncellar.space`,** which is why the sender domain in
  `SMTP_FROM` must not drift to another domain: an unaligned sender passes SPF and still fails
  DMARC.

## Sending a test letter

`POST /mail/test` is admin-only and sends one letter to one address:

```bash
curl -sS -X POST https://api.mooncellar.space/mail/test \
  -H 'content-type: application/json' \
  -H 'cookie: accessMoonToken=<an admin token>' \
  -d '{"to":"someone@example.com"}'
```

It answers `{ "sent": true, "to": …, "subject": … }` once the mail container accepted the
message, `400` for an address that does not parse and `503` when `SMTP_HOST` is unset. Accepted
is not delivered: what the mail server did with the message afterwards is in its log, and the
result is what the recipient's client shows.

To read the verdict rather than the letter, send one to an address whose headers can be
inspected: `Authentication-Results` then lists `spf=pass`, `dkim=pass` and `dmarc=pass` next to
the receiving provider's own name. A letter that passes SPF but not DKIM means the published
`mail._domainkey` record does not match the key in `MAIL_DKIM_DIR` — the usual cause is a key
regenerated without replacing its record.

## Outbound port 25

The container needs the host's outbound port 25 to reach a recipient's MX directly. It was
checked on 2026-11-02 from the host with a TCP connect to `gmail-smtp-in.l.google.com:25`, which
opened, so no relay through a provider is configured. Hosting providers often block that port;
if a future host does, `RELAYHOST`, `RELAYHOST_USERNAME` and `RELAYHOST_PASSWORD` on the `mail`
service send everything through a provider instead — and DKIM and SPF stay as they are, because
the letter is still signed and sent as `mooncellar.space`.

## Deliverability notes

- **A new IP has no reputation.** Gmail and Outlook score it neutral at best, and Outlook is
  known to drop even a correctly signed letter from an unknown address into spam for a few weeks.
  The leak is the sender's history: sending real letters regularly is what fixes it, not another
  DNS record.
- **Bounces are not received.** There is no inbound mail, so a message that cannot be delivered
  bounces into nothing. Do not promise delivery confirmation from a letter; a feature that needs
  it has to add an inbound mailbox first.
- **A letter is not a page.** Email clients strip `<style>` and ignore `CSS custom properties`,
  so the letters carry their colours inline from the same palette values as the site, and the
  typeface falls back to the system sans stack: ApercuPro is a licensed local file and cannot be
  served to a mail client.
