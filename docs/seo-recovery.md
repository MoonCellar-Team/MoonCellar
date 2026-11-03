# SEO recovery

mooncellar.space was demoted, and the answer is not to ask Google to look again. Nothing on the site
changes when a recrawl is requested, and a demoted site is crawled less whatever the button says.
What changes the outcome is the site itself, so the work is watched instead of guessed: four numbers
read every week, one report written down, and a rule about the one lever that feels like action and
is not.

## What is watched

| Measurement      | Where it comes from                                                        | Target            |
| ---------------- | -------------------------------------------------------------------------- | ----------------- |
| Crawl requests   | Search Console → Settings → Crawl stats, the daily totals                  | 1,000+ a day      |
| Indexed pages    | Search Console → Page indexing, the indexed count                          | up week over week |
| Impressions      | Search Console → Performance → Search results → Pages, over the whole week | up week over week |
| Average position | the same export, impression-weighted across every page it returned         | 15 or better      |

Crawl requests and the indexed count have no Search Console API — the Crawl stats report and the
Page indexing report exist in the UI only — so they are read by hand. The Performance report does
have an API, but its export is one click and the command below reads it, so the report needs no
credentials and no service account to keep alive.

## What counts as recovered

Both of these, for two weeks in a row:

- crawl requests back to 1,000+ a day;
- average position back to 10–15 — 15 or better counts, because the band is where the pages sat
  before the demotion, not a floor.

For scale: the site took 71,500 crawl requests in the ninety days to 2026-10-31, 794 a day, and
25,511 of them went to `api.mooncellar.space`, which answers JSON and has nothing to index. That
traffic is closed now, so the daily total falls before it rises: 1,000 a day has to be the site's own
pages being read, not the API swept again.

Impressions and the indexed count are the context, not the gate: they explain a week in which the
two numbers above did not move, and they are the first sign that a page Google had dropped is being
read again.

## Request indexing

While the site is demoted, "Request indexing" in URL Inspection is left alone.

It does not lift a demotion, it is not a ranking signal, and asking again for a page Google already
knows changes nothing — the page is recrawled on Google's own schedule, and a demoted site is
crawled less, not more, because a button was pressed. The button is for a URL that is new, or that
was excluded by a problem which has just been fixed; used as a weekly ritual it only hides how much
of the site Google reads on its own, which is the number this report exists to watch.

IndexNow is not a substitute here either: `api.indexnow.org` is read by Bing and Yandex, not by
Google, so the API's submissions neither help nor hurt this recovery.

## The week

Every Monday, for the Monday–Sunday week that just ended (the last days of the range may still be
filling in Google's data):

1. Performance → Search results → Pages, set the custom range to that Monday–Sunday, **Export → CSV**.
2. Settings → Crawl stats, read the daily totals of the same seven days.
3. Page indexing, read the indexed count.
4. Write the week:

   ```bash
   bun scripts/seo-report.ts new 2026-10-26 \
     --from ~/Downloads/Pages.csv \
     --crawl 832,901,877,940,1003,1105,1088 \
     --indexed 412 \
     --note "the new collection pages were published on Tuesday"
   ```

   `--crawl` takes the seven daily totals, or one number when the graph was read as an average;
   write them plain, without thousands separators, since the comma is the separator. `--note` is
   optional and is for what the numbers do not say.

5. Commit `docs/seo-recovery.md` and `docs/seo-recovery/`.

The export's columns are matched by name, so the exact header wording does not matter; it has to
carry page, impressions and position columns. Run `render --check` before opening a pull request
that touches the folder: it fails when a report or the table no longer matches the week files.

## The reports

`docs/seo-recovery/<week>.json` is the week itself: the crawl totals, the indexed count, the
impressions and the average position, and the 100 pages of the export with the most impressions. The
totals were computed over every page the export returned, not only the 100 kept.

`docs/seo-recovery/<week>.md` and the table below are generated from those files, so a week is
written once, in one place:

```bash
bun scripts/seo-report.ts render          # rewrite the reports and the table
bun scripts/seo-report.ts render --check  # write nothing, fail when they are out of date
```

The table is rebuilt on every render: a hand edit is lost on the next one, and `--check` fails until
the file matches the week data. A week report shows the four numbers against the week before and
against the targets, the daily crawl series, and the pages with the most impressions, with their
position in the previous week — which is where a page that came back is visible before the site-wide
average has moved. Its state is `recovering` while a target is missed, `on target` in the first week
both hold, and `recovered` once the second one holds too: the two weeks in a row above are computed,
not remembered.

## Weeks

<!-- weeks:start -->

_No week yet: the first `bun scripts/seo-report.ts new …` adds one._

<!-- weeks:end -->
