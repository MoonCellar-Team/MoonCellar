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
| Relay                      | Postfix hands every letter to Resend at `smtp.resend.com:587`, authenticated with the key in `MAIL_RELAY_DIR`; Resend delivers from its own addresses, which have the PTR and the reputation |
| Transport                  | The host's own address has no PTR, so the container never delivers directly — see [Why the relay](#why-the-relay) |

`boky/postfix` is a Postfix built for application mail: it takes messages on 587 from trusted
networks, signs them, and delivers them. It has no user accounts, no Dovecot and no spam filter,
because nothing ever connects to it from the internet.

**Submission inside the network is plaintext, on purpose.** The image ships a self-signed
certificate (`CN=localhost`), and `nodemailer` refuses it with `self signed certificate` /
`DEPTH_ZERO_SELF_SIGNED_CERT` — the send fails and the API answers 502 on every letter, although
the container itself is healthy. Rather than teach the API to ignore a certificate, the service
sets `POSTFIX_smtpd_tls_security_level: none`: the port is not published, the only peers are
containers on the `mooncellar` bridge, and the API already talks to MongoDB in plaintext over the
same network. Outbound TLS to recipients is a different setting (`smtp_tls_security_level`, left
at `may`) and is untouched.

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
| `SMTP_SECURE`                | `false`                                 | `true` only for a provider on port 465. The container's submission port has TLS switched off, so this stays `false`                                                                                                 |
| `SMTP_USER`, `SMTP_PASSWORD` | none                                    | Only when the API talks to a provider directly. The internal container allows the Docker networks (`POSTFIX_mynetworks`), and the relay login is its own business — see [Why the relay](#why-the-relay)         |
| `SMTP_FROM`                  | `MoonCellar <noreply@mooncellar.space>` | The `From` header, and the domain SPF and DMARC are checked against. **Its domain must stay `mooncellar.space`**                                                                                                   |
| `SMTP_REPLY_TO`              | none                                    | Optional `Reply-To`. Leave it empty while nothing reads the replies                                                                                                                                                |

The infrastructure side (`HOST_ENV_INFRA`):

| Variable        | Description                                                                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MAIL_DKIM_DIR` | Host directory bind-mounted as `/etc/opendkim/keys` — `/opt/mooncellar/mail-dkim`, which is the default in the compose file. The mount sets `create_host_path: false`, so the directory and its key must exist before the first infra deploy or compose refuses to start |
| `MAIL_RELAY_DIR` | Host directory bind-mounted as `/secrets`, holding Resend's API key in a file named `password` — `/opt/mooncellar/mail-relay`, also the default. Same `create_host_path: false`: the container refuses to start until the key is there, which is what stops a deploy from silently reverting to direct delivery |

## The DKIM key

The key is generated once on the host and never enters the repository. `infra/mail/generate-dkim.sh`
does the whole job and prints the DNS record to publish:

```bash
ssh root@31.57.201.233
mkdir -p /opt/mooncellar/mail-dkim
/opt/mooncellar/infra/mail/generate-dkim.sh mooncellar.space mail /opt/mooncellar/mail-dkim
```

It writes `mooncellar.space.private` and `mooncellar.space.public`, prints the `mail._domainkey`
record, and **refuses to overwrite an existing key**. That refusal is the point: the private key
and the published public key are one pair, and generating a second key under the same selector
breaks every letter signed with the first until DNS catches up.

**The image signs with rspamd, which imports whatever is in `/etc/opendkim/keys` when it starts**
and copies it into its own directory, so the letters go out signed `relaxed/relaxed` as
`d=mooncellar.space; s=mail`. The key is written into the OpenDKIM directory and set to `640`
owned by `opendkim` (uid `101`, gid `104`), the shape the image expects if the back-end is ever
switched to OpenDKIM. A key the signing process cannot read fails in silence — no error at send
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
| `rsend.mooncellar.space`           | `CNAME` | `rsend-euw1.forge.rmta.net.`                     | Resend's DKIM/SPF endpoint. The **trailing dot matters**: the DNS panel rejects a CNAME value without it                    |
| `send.mooncellar.space`            | `CNAME` | `send.forge.rmta.net.`                           | Resend's return-path domain. These two CNAMEs are the whole Resend setup — no `resend._domainkey` TXT and no MX are added |

Notes that matter:

- **The PTR record is set by the operator of the address, not in the zone.** The reverse zone of
  `31.in-addr.arpa` is delegated by RIPE, and the block `31.57.201.0/24` is registered to
  `netutils.io`, so this is a support request or a setting next to the VPS rather than a DNS
  entry. It cannot be skipped: without it Gmail and Outlook sort the letter into spam however
  good the other four records are.
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

## Letters

`mail.letter.ts` builds every letter from one `ILetter` shape: a heading, paragraphs, an optional
code block, an optional action button and a footnote. The product sends:

| Letter             | When                                                                       | Code            |
| ------------------ | -------------------------------------------------------------------------- | --------------- |
| Test letter        | `POST /mail/test`, admin only                                              | —               |
| Confirm your email | At sign-up, and on "Resend code"                                           | 6 digits, 10 min |
| Your sign-in code  | Signing in with e-mail two-factor, and turning e-mail two-factor on or off | 6 digits, 10 min |

A code is stored hashed (`sha256`) with a ten-minute TTL and at most five attempts, and a resend
is allowed once a minute. The plain-text part carries the same code as the HTML.

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

## Why the relay

The host's address has no reverse DNS and cannot get one: the reverse zone of `201.57.31.in-addr.arpa`
is not delegated, its parent `31.in-addr.arpa` is served by the RIRs, and the block belongs to
`netutils.io`, so a PTR there is a request to the operator of the address and nothing on the
machine can create it. Sending directly is not survivable without it — the same letter that Gmail
accepted was rejected by Yahoo at `MAIL FROM` with `550 5.7.25 Forward-confirmed reverse DNS
failed tnmpmscs`.

So the container relays, and Resend carries the letter out:

| Piece | Value |
|---|---|
| Relay | `smtp.resend.com:587`, SASL login `resend`, password read from `/secrets/password` |
| TLS to the relay | `POSTFIX_smtp_tls_security_level: encrypt` — the credentials must not travel in the clear |
| Key on disk | `/opt/mooncellar/mail-relay/password`, `600`, never in the repository and never in a GitHub secret |
| Mount | `/opt/mooncellar/mail-relay` → `/secrets`, **not `/run/secrets`** — see the gotcha below |

The letters are still signed by our own rspamd with `d=mooncellar.space; s=mail` before Resend
receives them, and Resend adds its own signature as well; DMARC is aligned either way, and the
`mail._domainkey` record already published stays in use.

**Mount the password somewhere other than `/run/secrets`.** `boky/postfix` declares
`VOLUME /var/run/`, and `/var/run` is a symlink to `/run`, so Docker puts an anonymous volume over
`/run` and the bind is masked: the container then dies at start with
`/scripts/common.sh: line 216: /run/secrets/password: No such file or directory` while the host
file is sitting right there. `/secrets` works.

**The root SPF is not involved in relayed letters, and that is deliberate.** Resend sends with a
return-path on `send.mooncellar.space`, so SPF is evaluated against that name and its own record.
Do not add `include:amazonses.com` to `mooncellar.space` "to make it match": it would authorise
every Amazon SES customer to pass SPF as this domain, which is exactly the hole strict DMARC
alignment exists to close.

## Outbound ports

The container now needs outbound `587` to `smtp.resend.com` and nothing else. Its direct-delivery
path is still there and would need outbound `25`, which the host does allow — that check was run
on 2026-11-02 with a TCP connect to `gmail-smtp-in.l.google.com:25`, and it opened. Resend being
down only fills the local Postfix queue; the letters are retried, not lost, and the spool survives
a `docker compose up` on the service because compose keeps the container's volumes.

One consequence of relaying with no inbound mail: when a delivery fails, Postfix generates a
non-delivery report addressed to `noreply@mooncellar.space`, and Resend refuses that message
(`550 Invalid 'from' field`, the DSN has no real sender). The report is dropped, which is the same
outcome as before — nobody can read a bounce at an address that has no mailbox.

## Deliverability notes

- **A new IP has no reputation.** Gmail and Outlook score it neutral at best, and Outlook is
  known to put even a correctly signed letter from an unknown address into spam for weeks. What
  repairs that is history — real letters sent regularly — not another DNS record.
- **Bounces are not received.** There is no inbound mail, so a message that cannot be delivered
  bounces into nothing. Do not promise delivery confirmation from a letter; a feature that needs
  it has to add an inbound mailbox first.
- **A letter is not a page.** Email clients strip `<style>` and ignore `CSS custom properties`,
  so the letters carry their colours inline from the same palette values as the site, and the
  typeface falls back to the system sans stack: ApercuPro is a licensed local file and cannot be
  served to a mail client.
