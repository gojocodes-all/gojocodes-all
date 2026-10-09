# Maintenance log

## 2026-10-09 — Pin profile workflow dependencies

- **Rationale:** The profile test and publishing workflows referenced mutable action tags. A tag owner could move those references after review, and checkout retained its injected GitHub credential even though only the final publishing action needs authenticated repository access.
- **Files changed:** `.github/workflows/profile-tests.yml`, `.github/workflows/snake.yml`, `test/workflows.test.mjs`, and this log.
- **Changes:** Pin checkout, snake generation, and output publication actions to their resolved immutable commit SHAs; disable checkout credential persistence; run the complete test directory in both workflows; and add regression checks for immutable action references and least-privilege permissions.
- **Validation:** `node --test test/*.test.mjs`; workflow security assertions; complete diff review for permissions, publishing behavior, credential scope, and repository conventions.
- **Risk level:** Low. The pinned commits are the exact revisions previously selected by `v4`, `v3`, and `v3.1.0`. The generator, schedule, output branch, token handoff, and generated assets are unchanged.
- **Rollback:** Revert this pull request to restore tag-based action references and the previous test commands.

## 2026-10-03 — Increase refresh cadence and split activity timescales

- **Rationale:** The profile graphics refreshed only once daily, and the single weekly graph hid day-to-day activity. The profile now needs a close daily view and a longer weekly view without adding third-party widget dependencies.
- **Files changed:** `README.md`, `.github/workflows/snake.yml`, `scripts/generate-profile-cards.mjs`, `test/generate-profile-cards.test.mjs`, and this log.
- **Changes:** Regenerate stats and snakes at minutes 17 and 47 of every hour; add responsive 30-day daily bar charts; preserve responsive 30-week weekly charts; and add a truthful 365-day commits/PRs/issues/reviews/repositories/private/join mix to the overview card.
- **Validation:** `node --test test/generate-profile-cards.test.mjs`; generated desktop and mobile SVGs inspected for clipping and readable labels.
- **Risk level:** Low. The generator remains dependency-free and uses the existing GitHub token and output branch.
- **Rollback:** Revert this change to restore the daily schedule and single weekly activity graphic.

## 2026-09-25 — Add regression coverage for generated profile graphics

- **Rationale:** The scheduled workflow publishes generated SVGs directly to the profile README, but the calculation and rendering helpers had no automated regression coverage.
- **Files changed:** `.github/workflows/profile-tests.yml`, `.github/workflows/snake.yml`, `test/generate-profile-cards.test.mjs`, and this log.
- **Validation:** `node --test test/generate-profile-cards.test.mjs`; a read-only pull-request workflow runs the suite before merge, and the publishing workflow repeats it before generation and publication.
- **Risk level:** Low. Production generator behavior is unchanged; this adds dependency-free test gates with read-only permissions for pull requests.
- **Rollback:** Revert the commits to remove the tests, workflow gates, and maintenance entry.
