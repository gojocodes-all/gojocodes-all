# Maintenance log

## 2026-09-25 — Add regression coverage for generated profile graphics

- **Rationale:** The scheduled workflow publishes generated SVGs directly to the profile README, but the calculation and rendering helpers had no automated regression coverage.
- **Files changed:** `.github/workflows/profile-tests.yml`, `.github/workflows/snake.yml`, `test/generate-profile-cards.test.mjs`, and this log.
- **Validation:** `node --test test/generate-profile-cards.test.mjs`; a read-only pull-request workflow runs the suite before merge, and the publishing workflow repeats it before generation and publication.
- **Risk level:** Low. Production generator behavior is unchanged; this adds dependency-free test gates with read-only permissions for pull requests.
- **Rollback:** Revert the commits to remove the tests, workflow gates, and maintenance entry.
