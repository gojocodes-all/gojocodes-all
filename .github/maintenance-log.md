# Maintenance log

## 2026-10-03 — Increase refresh cadence and split activity timescales

- **Rationale:** The profile graphics refreshed only once daily, and the single weekly graph hid day-to-day activity. The profile now needs a close daily view and a longer weekly view without adding third-party widget dependencies.
- **Files changed:** `README.md`, `.github/workflows/snake.yml`, `scripts/generate-profile-cards.mjs`, `test/generate-profile-cards.test.mjs`, and this log.
- **Changes:** Regenerate stats and snakes at minutes 17 and 47 of every hour; add responsive 30-day daily bar charts; preserve responsive 30-week weekly charts; and add a truthful 365-day commits/PRs/issues/reviews mix to the overview card.
- **Validation:** `node --test test/generate-profile-cards.test.mjs`; generated desktop and mobile SVGs inspected for clipping and readable labels.
- **Risk level:** Low. The generator remains dependency-free and uses the existing GitHub token and output branch.
- **Rollback:** Revert this change to restore the daily schedule and single weekly activity graphic.

## 2026-09-25 — Add regression coverage for generated profile graphics

- **Rationale:** The scheduled workflow publishes generated SVGs directly to the profile README, but the calculation and rendering helpers had no automated regression coverage.
- **Files changed:** `.github/workflows/profile-tests.yml`, `.github/workflows/snake.yml`, `test/generate-profile-cards.test.mjs`, and this log.
- **Validation:** `node --test test/generate-profile-cards.test.mjs`; a read-only pull-request workflow runs the suite before merge, and the publishing workflow repeats it before generation and publication.
- **Risk level:** Low. Production generator behavior is unchanged; this adds dependency-free test gates with read-only permissions for pull requests.
- **Rollback:** Revert the commits to remove the tests, workflow gates, and maintenance entry.
