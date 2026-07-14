# Soft-launch ops checklist (Stage B)

## Production gate

- [x] Soft-launch eng (B0 + B-R toolbox) in repo
- [x] `VITE_CONTACT_EMAIL` / `VITE_PLAUSIBLE_DOMAIN` as GitHub Actions **Variables** (Pages build)
- [x] Deploy on push to `master` (workflow: `deploy-pages.yml`)
- [ ] **Human once:** open FormSubmit **Activate** link from first Stay updated / Feedback submit on production
- [ ] **Human once:** confirm Plausible site + goals for `kellybyron2222-dev.github.io`
- [ ] Smoke on live URL after deploy (below)

## Smoke test (live Pages)

1. Load https://kellybyron2222-dev.github.io/labrador-critical-minerals-explorer-v3/
2. Welcome → Start exploring
3. Screen → Radius → drop pin → Screen this area → report opens
4. Measure a short line; Annotate a pin
5. Pin A → change layers → Compare → Exit
6. Settings → Export helper on → download ZIP
7. Stay updated with a real email → check inbox (Activate if first time)
8. Feedback with a short note → check inbox

## Outreach

- [x] NLPA one-pager draft — [`NLPA-one-pager.md`](./NLPA-one-pager.md)
- [x] Screenshot storyboard — [`screenshot-storyboard.md`](./screenshot-storyboard.md)
- [ ] Capture 5–10 screenshots (operator)
- [ ] Send NLPA / personal emails (operator)

## After first replies

- Daily inbox check (FormSubmit / mailto)
- Triage bake failures from `refresh-data` workflow Issues within a week
- Do **not** start Monthly Data Changelog until there is a real list + a real data delta
