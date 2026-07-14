# Labrador Critical Minerals Explorer — Product Plan

> **Strategic overview** (go-to-market, freemium, geography expansion).
> Engineering checklist stays in [`BUILD_PLAN.md`](./BUILD_PLAN.md).
> Last updated: 2026-07-14 — Soft-launch readiness (B-R) closed: everyday tools,
> Screen Radius, Pin A Compare, ops vars on Pages, outreach drafts in
> `docs/soft-launch/`. **Stage B outreach open** (capture Activate + screenshots
> are the remaining operator steps).

---

## 1. Vision in one line

A **free, trustworthy map** that anyone can use to understand Labrador (then
Canada) critical-mineral context — with **optional paid tools** for people
whose job is to find, stake, and site projects faster than competitors.

**North star users**
- Independent prospectors and NLPA members (budget-sensitive → free forever core)
- Junior mining geos / land managers (time = money → pay for alerts, export, signals)
- Consultants and students (mix of free + occasional premium)

---

## 2. Ideal sequence (recommended)

Your sketch was:

> MVP Labrador → MVP v2 national → market free → premium (free) → premium v2 → paywall

That order **markets too late** and **goes national before product-market fit**.
National expansion is expensive (many jurisdictions, tenure systems, hosting).
Niche word-of-mouth works best when the product is *regionally deep*, not thin
coast-to-coast.

### Recommended arc

```text
A  Labrador MVP (free)          ← finish BUILD_PLAN Musts (incl. geophysics 4.1)
B  Soft launch + niche marketing ← while still Labrador-deep
B-R Soft Launch Readiness         ← geo toolbox + ops gate (before first invite)
B+ Monthly Data Changelog email ← retention loop once list + deltas exist
C  Premium v1 (free beta)        ← alerts, export, logistics (+ geochem)
   └─ C′ Export schema hardening ← normalize MODS/nulls; CRS/provenance in package
D  Freemium paywall              ← clear Free vs Premium split
E  National / multi-region v2    ← expand geography once free+paid stick
F  Premium v2                    ← multi-jurisdiction + collaboration + API
G  Professional data platform    ← Leapfrog-adjacent open Labrador DB (long-term)
```

| Stage | What ships | Price | Goal |
|---|---|---|---|
| **A — Labrador MVP** | Geology, MODS, rights, **geophysics (1VD/gravity)**, fatal-flaw screen, infrastructure, honest labels | Free | Answer the siting + subsurface-structure questions for Labrador |
| **B — Make it known** | Same product + landing / About + outreach | Free | First 50–200 real users; learn what they click |
| **B+ — Monthly changelog** | Auto (then lightly reviewed) technical delta email: new layers, feature bullets, land-status teases | Free | Return visits + map CTR; later upgrade intent |
| **C — Premium v1 (beta)** | Claim expiry alerts, bulk export, logistics score; optional higher-res / multi-region signals | **Free during beta**, clearly labeled | Habit + willingness-to-pay signal |
| **C′ — Export / schema hardening** | Machine-friendly export (nulls, aliases, CRS sidecar, distance columns); still *not* a 3D project DB | Free core / Premium packaging | Best open Labrador *screening* package |
| **D — Paywall** | Free tier stays useful; premium locks | Modest monthly / annual | Convert juniors & consultants |
| **E — National MVP v2** | Next province/territory or Canada-wide layers (phased) | Free core + paid premium | Scale after monetization works |
| **F — Premium v2** | Multi-region alerts, saved projects, team seats, API | Paid (+ higher tier optional) | Expand ARPU without killing free utility |
| **G — Professional data platform** | Relational open schema, geochem, drillholes where public, structural geology, elevation — see §2.1 | Free browse + paid bulk/API | Leapfrog-*adjacent* intelligence, not a Surpac replacement |

### 2.1 Long-term: professional / Leapfrog-grade data quality  [north star — not Stage B]

External audit (2026-07): export CSVs look like a strong **regional reconnaissance
DB**, not a Leapfrog Geo / Target / Micromine project database. That verdict is
fair for *screening vs modeling* — and **most “missing” tenure / roads / rail /
geology / geophysics layers already exist in the app** (lazy, off by default;
polygons/lines export as GeoJSON, not CSV).

**Product identity (keep):** best open Labrador **screening + context** map.
**Do not promise:** replace Leapfrog / Surpac / Datamine as a 3D modeling workspace.

**Why not now (Stage B):** wrong bottleneck. Soft launch needs users and
willingness-to-pay signal before months of ETL, relational schema, and sparse
public drillhole/assay coverage. Premature “enterprise DB” work burns Stage C
capacity and can make later paid export harder to position.

**Sequenced ambition**

| Horizon | What | When |
|---|---|---|
| **Cheap wins** | CRS/provenance in every export package; normalize MODS −1/blank→null; alias DDH→drillHoleCount; clarify commodity columns; optional nearest-infra distance columns (already in popups); “enable Claims/Roads/… for full package” UX | Stage **C′** with Premium export packaging (small pieces OK earlier if trivial) |
| **High-value open data** | Phase **4.2** lake/till geochem + ice-flow; structural geology if a clean NL source exists; elevation sample-on-export | Stage **C** depth / early **E** |
| **Professional-grade (G)** | Coded domains (statusCode); depositModelCode where mappable; per-row provenance; relational occurrence↔commodity↔mineral tables for bulk/API; drillhole collars/surveys/assays **only where public**; resource tables only with citable NI 43-101-class sources | Stage **G** after paywall + clear demand — BUILD_PLAN §5.2 |

**Pros of Stage G (later):** credibility with senior geos; export as a real
sales asset; differentiation vs raw GeoAtlas dumps.
**Cons if done in Stage B:** huge scope vs incomplete open data; identity drift
toward “why no 3D?”; opportunity cost vs outreach / alerts / geochem; ongoing
QA burden on every GeoAtlas refresh.

Engineering checklist: [`BUILD_PLAN.md`](./BUILD_PLAN.md) §5.2
**Professional data quality**.

### Why this order

1. **Market Labrador before going national.** Depth beats breadth for CEO.ca /
   NLPA / Mineral Resources Review. “Best free Labrador explorer” is a sharper
   story than “another thin Canada map.”
2. **Build premium features in public as free beta.** Users learn the workflow;
   you learn which features actually get used before charging.
3. **Paywall before national.** Monetization proves the model on one region’s
   data costs. Expanding geography while still 100% free multiplies cost with
   no revenue.
4. **Never bait-and-switch the free core.** The open map (layers, browse,
   basic filters) stays free forever. Paid = time-savers and edge data.

### What stays free forever (non-negotiable)

- Map browse, basemaps, Labrador endowment / MODS / rights / infrastructure
- **Labrador public geophysics** (1VD/aeromag + gravity from GeoAtlas — MVP)
- Commodity + status filters, occurrence list/search, KPI strip
- Fatal-flaw / **hard exclusions** screening (parks & water supplies — public
  constraints should not be gated; Indigenous lands stay free context toggles)
- Provenance / About data, shareable view links (when built)
- Reasonable personal / educational use

### What becomes Premium (after free beta)

See §4. Rule of thumb: **if it saves a GIS tech an afternoon or wins a staking
race, it can be paid.** Public Labrador geophysics stays free; paid edge is
alerts, bulk export packaging, logistics scoring, and later multi-region /
higher-convenience signal packs.

---

## 3. Stage detail

### Stage A — Labrador MVP (free)  [x eng gate met]

**Engineering MVP gate** (call Stage A “built” when these are done):

- Phase **3.1–3.4** infrastructure (roads, rail, ports, power, communities,
  NRCan facilities under Infrastructure, nearest-infra distances on MODS
  popup) ✅
- Phase **4.1** geophysics MVP slice (**1VD / aeromag / radiometrics** +
  **gravity** + survey footprints w/ type·digital filters + detail popup) ✅
  (2026-07-12) — gravity via local NRCan 2 km Bouguer GeoTIFF bake; footprints
  stay full index (not digital-only); no extra per-survey raster bakes for MVP
- Phase **2.4** hard exclusions (fatal-flaw) preset ✅ (2026-07-12) — CPCAD +
  public water supplies only; Indigenous lands = consultation context
- Phase **1.1g** facilities / value-chain label honesty ✅ (2026-07-12)
- Soft-launch Shoulds ✅ (2026-07-12): **2.1c** claim expiry · **1.4** bedrock
  mutual exclusion · About data · GeoJSON export · legend declutter

**Soft-launch bar** (met): engineering gate + expiry colors + About — ready for
niche outreach (Stage B).

**Exit:** public GitHub Pages app that a prospector can use without an account.

#### Will people want this? (honest product check)

**Yes — for a specific job.** The free MVP helps when someone needs to answer,
in one place:

1. What’s in the ground here? (bedrock / surficial / prospectivity)
2. What does the **subsurface structure** look like under cover? (1VD/aeromag +
   gravity)
3. Has anyone found or claimed something? (MODS + claims / tenure)
4. Can I even work here? (hard exclusions = parks / conserved / water
   supplies; Indigenous lands = process hurdle, not a total block)
5. Can I physically develop it? (roads / rail / ports / power)

That job is real for independent prospectors, students, and junior geos who
today bounce between NL GeoAtlas, NRCan viewers, CPCAD, and ATRIS. Integration
+ Labrador depth + free geophysics is the wedge — not “replace ArcGIS / S&P /
drilling.”

**Who it helps most at launch**
- Prospectors / NLPA: screen ground, see structure under cover, open vs claimed,
  avoid restricted land
- Junior geos / land: quick context before opening desktop GIS
- Curious investors / students: orientation map (bonus audience)

**Who it will not satisfy yet (and that’s OK)**
- Quantitative till/lake geochem + ice-flow tracing (Phase 4.2 / Stage C+)
- Field crews who need AOI → KMZ/Shapefile (Stage C premium export)
- Landmen who need email alerts the day a claim lapses (Stage C alerts)
- Anyone needing Canada-wide depth (Stage E)
- Anyone needing a Leapfrog-grade project DB (drillholes, relational assays,
  coded deposit models) — Stage **G** / BUILD_PLAN §5.2; Stage **C′** is
  export hygiene only

**Launch verdict:** Must gate (incl. geophysics) = enough to be *useful to
geos*. Soft-launch bar (Must + expiry colors + About) = enough to be
*recommendable*. Do not wait for national, geochem, or paywall before Stage B
outreach.

---

### Stage B — Soft launch & niche marketing (free)  [outreach open]

Start **as soon as Stage A is usable** — do **not** wait for national or for
premium features. Audience is small and specialized; broad ads waste money.

#### Channel priority (recommended first → later)

| Priority | Channel | Why first / later |
|---|---|---|
| **1st** | **NL Prospectors Association (NLPA)** + personal outreach | Exact ICP; word-of-mouth is provincial; free tool fits their budget |
| **2nd** | **LinkedIn** insight posts (not ads) | Geos/execs live here; share a *finding* from the map + link |
| **3rd** | **Mineral Resources Review** (St. John’s) digital presence | Hashtags / presenter tagging around Labrador juniors — no booth required |
| **4th** | **CEO.ca** targeted rooms | High signal for juniors/investors; post screenshots of *specific* Labrador projects, not generic promo |
| **Later** | Reddit (r/geology, r/Mining, r/Prospecting) + Stockhouse | Wider but noisier; use after you have a crisp one-liner + screenshots |

#### Soft-launch checklist

- [x] Short landing blurb on the app (what it is / isn’t; free; Labrador focus;
      data sources) — first-visit welcome + Settings → About (2026-07-13)
- [x] 5–10 screenshot “story” assets brief — [`docs/soft-launch/screenshot-storyboard.md`](./docs/soft-launch/screenshot-storyboard.md)
      (operator captures stills from live app)
- [x] One-pager email for NLPA / prospectors —
      [`docs/soft-launch/NLPA-one-pager.md`](./docs/soft-launch/NLPA-one-pager.md)
- [x] Simple waitlist or email capture (`VITE_CONTACT_EMAIL` FormSubmit and/or
      Formspree ids) for product / changelog updates — same list feeds
      **Monthly Data Changelog** (B+) once there is something real to report
      (2026-07-13; FormSubmit FormData + mailto fallback 2026-07-14; Pages
      Variables set 2026-07-14 — open FormSubmit Activate once on first prod submit)
- [x] Track crude usage (Plausible privacy-light) (2026-07-13)
- [x] Shareable view URL + multi-layer viewport export ZIP (GeoJSON / CSV / KML /
      display rasters as PNG+bounds; Shapefile via QGIS from GeoJSON) (2026-07-13)
- [x] B-R everyday tools — Screen Radius, Measure/Polygon, Annotate pins, Bookmarks,
      Pin A / Compare swipe, Print, context menu, opacity, extent history, GPS
      (2026-07-14)
- [x] Ops runbook — [`docs/soft-launch/ops-checklist.md`](./docs/soft-launch/ops-checklist.md)

#### Messaging angle

> Free, open Labrador critical-minerals map that pulls the scattered public
> layers into one place — so you spend time on geology, not fighting the atlas.

Avoid promising “AI discovery” or paid-platform parity at launch.

#### Retention loop — Monthly Data Changelog (post soft-launch)  [ ]

Ship this **after Stage B has a real email list and at least one meaningful
data or product delta month** — not as part of the MVP eng gate. Empty or
fluffy first issues train users to ignore you.

**Feature:** Automated B2B engagement loop (monthly technical delta email)

**Core objective:** Recurring return visits and map traffic with near-zero
manual editorial overhead — a changelog, not a newsletter.

**Content philosophy — strict zero-fluff**
- High-density technical delta only. No industry commentary, no “exciting
  updates,” no marketing jargon (alienates geos and land execs).
- Cap ~150 words. Three sections max. Deep links into the map where possible
  (layer on, AOI framed, not just the homepage).

**Key data tranches**

| Tranche | What to say | Example |
|---|---|---|
| **Data infrastructure** | Newly ingested provincial / federal layers | *Added 1VD Magnetics for Western Labrador* |
| **Commercial triggers** | Aggregate land-status stats that hint Premium value | *42 claims expiring in the Central Mineral Belt in the next 30 days* |
| **Product features** | New tools / UI that change how people work | *Fatal-flaw preset now includes [X]* |

Commercial triggers are **teasers**, not paywalled secrets: free users should
still see the relevant map context; Premium is the *alert / watchlist /
export* convenience. Soften or omit commercial rows until Stage C alerts exist
so the tease is honest.

**Build approach (recommended)**

1. **Source of truth first, LLM second.** Maintain structured changelog events
   (ingestion log rows: layer id, region, date; optional curated “shipped”
   feature bullets). Do **not** dump raw GitHub history into the model as the
   primary input — commit noise produces fluff and wrong user-facing claims.
2. **Monthly cron** assembles the month’s events → LLM formats only (strict
   prompt: bullets, ≤150 words, remove marketing language, refuse if empty).
3. **Human gate (v1):** draft to a private review inbox / Slack; one-click
   approve → send. Automate send only after 2–3 clean months.
4. **Distribute** via Resend / Postmark / SendGrid to the Stage B waitlist +
   later authenticated users. Prefer double opt-in; easy unsubscribe.
5. **UTM + deep links** so success metrics are measurable (see below).

Optional later: GitHub releases / labeled PRs as a *secondary* feature-bullet
feed — still filter to user-visible changes, never raw diffs.

**Success metrics**
- Free → map click-through on data-layer links (primary engagement)
- CTR on commercial-trigger links → Premium waitlist / upgrade intent
- Unsubscribe rate and “empty month skip” rate (skip send if no material delta)

**Will this drive engagement?** Likely **yes for this ICP**, if kept sparse and
technical. Prospectors and junior geos already live on data freshness and land
status; a short monthly delta beats a blog. It will **not** help if months are
thin, copy drifts marketing-y, or links dump users on a generic landing page.
Treat it as a retention instrument for people who already opted in — not a
cold-acquisition channel.

**Exit:** 2+ months with measurable map CTR and stable unsubscribes before
fully unattended send.

---

### Stage C — Premium v1 features (free beta)  [ ]

Build the paid-worthy capabilities **while still free**, with UI badges like
`Premium · free during beta`. Collect waitlist emails. This maps to BUILD_PLAN
Phase 4 / Phase 5 / §5.2 items, promoted deliberately.

| Premium v1 feature | Why people pay | Free-tier alternative (after paywall) |
|---|---|---|
| **Real-time / frequent claim expiry alerts** | Stake ground when it lapses; beat slower competitors | Static expiry color on map; no email/push alerts |
| **Bulk spatial export** (draw box → Shapefile / KMZ / GeoJSON) | Saves GIS tech hours | View-only; maybe tiny CSV of visible MODS names only |
| **Export schema hardening (C′)** | Machine-ready package (nulls, aliases, CRS, distances) | Current viewport ZIP; raw MODS quirks documented in About |
| **Logistical viability indexing** | Instant distance-to-road/port/power + score | Manual eyeballing; optional one-off distance measure on free |
| **Multi-region / packaged signal packs** (later) | Convenience beyond free Labrador public layers | Free Labrador **1VD + gravity** already in MVP |

> **Note:** Labrador public geophysics ships in **Stage A free forever** — do
> not put basic GeoAtlas 1VD/gravity behind the paywall. Premium is alerts,
> export packaging, scored logistics, and later multi-region convenience.
> Full Leapfrog-adjacent relational DB is **Stage G**, not a Premium v1
> checkbox — see §2.1.

**Also ship in beta (supporting):** account-light auth (magic link), saved
aoi/bookmarks, alert preferences.

**Exit:** features used weekly by a core of beta users; qualitative “I’d pay
$X for alerts/export” feedback.

---

### Stage D — Freemium paywall  [ ]

Turn on billing when:

1. Free core is stable and clearly valuable alone, **and**
2. At least two Premium v1 features are sticky (likely **alerts** + **export**), **and**
3. You can explain Free vs Premium in one screen.

**Suggested pricing posture (decide later with data)**

- Modest monthly for individuals / prospectors
- Annual discount
- Small-team seat pack for juniors
- Optional: free Premium month for NLPA members at launch of paywall (goodwill)

**Principles**

- No dark patterns; grandfather beta testers briefly if you promised it
- Public data layers remain free to *view*
- Paid = processing, alerting, packaging, and convenience on top of public data

---

### Stage E — National / multi-region MVP v2  [ ]

Expand **after** Labrador free+paid is working.

**Expansion options (pick based on demand, not vanity)**

1. Rest of Newfoundland (island) — same province, shared GeoAtlas muscle
2. Another critical-minerals jurisdiction with strong open data (e.g. parts of
   QC / ON / NT) — one region at a time
3. Canada-wide thin layer (NRCan national only) as context, with deep provinces
   as premium or phased free

**Do not** clone Labrador depth nationwide in one leap. Reuse the Add-a-Layer
playbook; treat each province as a product epic.

---

### Stage F — Premium v2  [ ]

Once multi-region exists:

- Multi-jurisdiction claim expiry / assessment-credit watchlists
- Team workspaces, shared AOIs, roles
- API / bulk feeds for consultants
- Advanced spatial query (“Cu showings within 20 km outside protected areas”)
- Higher-tier data packs if licensing allows

---

## 4. Premium catalog (from market feedback)

Prioritized for **Stage C** (build order):

1. **Claim expiration / assessment-credit alerts** — highest “money on the
   ground” urgency; pairs with BUILD_PLAN 2.1c styling → then push/email
2. **Bulk AOI export** (GeoJSON → then KMZ / Shapefile) — BUILD_PLAN Phase 5
   export, then §5.2 formats
3. **Logistical viability index** — BUILD_PLAN 3.4 distances → scored index
4. **Multi-region / packaged signals** (after Stage E) — not gating Labrador
   public geophysics

**MVP free (Stage A), not premium:** BUILD_PLAN **4.1** Labrador 1VD/aeromag +
gravity (+ survey footprints when available).

Supporting free-forever items that make premium sell better: hard-exclusion
mask (parks/water), infra layers, geophysics, honest facilities labels, clean UX.

---

## 5. Free vs Premium cheat sheet (target end-state)

| Capability | Free | Premium |
|---|---|---|
| Map + Labrador public layers | ✅ | ✅ |
| Labrador public geophysics (1VD / gravity) | ✅ | ✅ |
| Filters, list, KPI, shareable view | ✅ | ✅ |
| Fatal-flaw / hard exclusions (parks + water supplies) | ✅ | ✅ |
| Claim expiry **colors** on map | ✅ | ✅ |
| Claim expiry **alerts** (email/watchlist) | ❌ | ✅ |
| Measure distance | ✅ (basic) | ✅ |
| Auto logistics **score** | ❌ | ✅ |
| Export CSV of on-screen list | ✅ limited | ✅ |
| Draw AOI → GeoJSON / KMZ / Shapefile | ❌ | ✅ |
| Saved projects / multi-region watchlists | ❌ | ✅ (v2) |

Tune this table when Stage C usage data arrives.

---

## 6. Relationship to `BUILD_PLAN.md`

| Product stage | Primary engineering home |
|---|---|
| A Labrador MVP | BUILD_PLAN Phases **3** + **4.1 geophysics** (2.4 / 1.1g / soft-launch Should ✅) |
| B Marketing | Landing/About copy; light analytics; no heavy eng |
| B+ Monthly changelog | Ingestion event log + optional curated ship notes; cron → LLM format → email API; human approve v1 |
| C Premium v1 beta | Phase 5 export; 2.1c→alerts; 3.4→index; Phase **4.2** geochem |
| C′ Schema hardening | BUILD_PLAN §5.2 Professional data quality — cheap wins |
| D Paywall | Auth, billing, entitlement gating (new eng workstream) |
| E National v2 | New geographic epics using §6 Add-a-Layer playbook |
| F Premium v2 | Collaboration / API + remaining §5.2 product backlog |
| G Professional data platform | §5.2 Professional data quality — full ambition (§2.1) |

`BUILD_PLAN.md` remains the day-to-day checklist. This file is the **why / when /
who pays** layer above it.

---

## 7. Open decisions

- [ ] Brand / product name for public launch (keep “Labrador Critical Minerals
      Explorer” vs shorter consumer name)
- [ ] Auth provider (magic link vs OAuth) for alerts + billing
- [ ] Payment provider (Stripe) and exact price points
- [ ] First national expansion target after Labrador
- [ ] Whether NLPA gets perpetual free Premium seats (sponsorship-style)
- [ ] Email ESP for changelog + later alerts (Resend / Postmark / SendGrid)
- [ ] Changelog send policy: skip month if no material delta vs always-send

---

## 8. Changelog

- **2026-07-14** — Soft-launch **B-R closed**: Screen Radius (replaces Go-to+25 /
  Buffer), Annotate pins, Pin A→Compare swipe, Bookmarks/Print/context menu;
  Pages `VITE_CONTACT_EMAIL` + Plausible Variables set; outreach drafts under
  `docs/soft-launch/`. **Next = Stage B outreach** (capture screenshots, send
  NLPA one-pager, Activate FormSubmit on first prod submit).
- **2026-07-14** — Added **§2.1 Professional / Leapfrog-grade data quality**
  north star: Stage **C′** cheap export hygiene vs Stage **G** full ambition;
  do **not** prioritize during Stage B outreach. Mapped into arc + BUILD_PLAN
  §5.2. FormSubmit capture hardening noted on soft-launch checklist.
- **2026-07-13** — Stage **B0** eng shipped: welcome, Plausible, Formspree hooks,
  shareable views, multi-layer free export ZIP. Soft-launch checklist eng items
  closed; **next = Stage B outreach** (screenshots + NLPA) + Formspree config.
- **2026-07-12** — Phase **4.1** footprint UX closed: keep full survey index;
  type + digital filters; detail popup → NL airborne page. Confirmed no MVP
  need to bake top-N individual digital surveys (already covered / not on
  MapServer). Stage A eng gate remains met; **next = Stage B soft launch**.
- **2026-07-12** — Phase **4.1** complete: gravity (NRCan Canada 2 km Bouguer)
  baked from local GeoTIFF; Stage A eng gate closed. Soft launch (Stage B) unblocked.
- **2026-07-12** — Phase **4.1** partial ship: GeoAtlas aeromag + detailed 1VD +
  survey footprints in Signals group. Gravity corrected to NRCan AGG (not
  GeoAtlas); bake blocked on AGG host reachability. Soft-launch still waits on
  gravity for full Stage A eng gate.
- **2026-07-12** — Stage A: Phase **3** infrastructure closed (facilities under
  Infrastructure, nearest-infra distances, accuracy polish) and curated Labrador
  airport/port/community inventory expanded after CFS coverage audit (16/10/21).
  Next engineering gate item = Phase **4.1** geophysics.
- **2026-07-12** — Docs pass: README standalone (no merger framing); Stage A
  / BUILD_PLAN mapping notes that soft-launch Shoulds + Must 2.4/1.1g are done.
- **2026-07-12** — Added **Stage B+ Monthly Data Changelog**: zero-fluff
  automated technical delta email (structured ingestion events → LLM format →
  human-approved send); retention metrics; wired into arc, Stage B list
  capture, and BUILD_PLAN mapping.
- **2026-07-12** — Pre–Phase 3 close-out reflected in Stage A (1.1g, 1.4, 2.1c,
  About/export/legend lite done; next eng = Phase 3.1 + 4.1).
- **2026-07-12** — Phase **2.4** refined to **hard exclusions**: CPCAD + public
  water supplies only; Indigenous lands are consultation hurdles, not the mask.
- **2026-07-12** — Phase **2.4** complete (fatal-flaw preset); Stage A gate
  checklist updated.
- **2026-07-12** — **Geophysics pulled into MVP Must** (Phase 4.1: 1VD/aeromag +
  gravity, free forever). Premium catalog no longer gates basic Labrador
  geophysics; Stage C focuses on alerts / export / logistics score. Aligned
  with BUILD_PLAN.
- **2026-07-12** — Stage A clarified: engineering MVP gate vs soft-launch bar
  (Musts + 2.1c expiry colors + About blurb); added honest “will people want
  this?” product check.
- **2026-07-12** — Initial product plan: recommended arc A→F (Labrador MVP →
  niche marketing → premium free beta → paywall → national → premium v2);
  freemium cheat sheet; marketing channel priority (NLPA first); premium
  feature catalog; link to BUILD_PLAN Must gate.
