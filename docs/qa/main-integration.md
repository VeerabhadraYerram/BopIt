# Main integration — 2026-11-07

Inputs: incoming `origin/main` at `c4d0437` and local UX/recognition snapshot `6d49fa7`. The pre-integration source archive is retained in ignored `.local/integration-backup-20261107/source.zip`. Credentials and model caches were excluded from the archive and commits.

## Functionality retained

| Incoming main | Integrated result |
|---|---|
| Visible colour/material/brand/model fields | Preserved in recognition contract and conservative Gemini prompt, alongside detailed profiles |
| Exact / visually similar searches | Retained as Find this / Similar look, using image+text search and optional photo evidence |
| Lower-priced alternatives | Preserved under More search options; ascending price within each currency, no cheaper-than-original claim |
| Deterministic listing-evidence ranking | Preserved; used before deeper visual assessments and for unassessed candidates |
| Relevance / lowest / highest price | Preserved; explicit price sorting overrides AI relevance |
| Budget presets and custom budget | Preserved; currency-specific filtering, no exchange-rate conversion |
| Brand filter | Preserved using brands returned by the provider |
| Three-product comparison | Preserved; mixed or missing currencies are marked not directly comparable |
| Device-local wishlist | Preserved using existing `savedProducts` storage key; serialized writes prevent lost simultaneous updates |
| Correction provenance | Preserved; user edits display the original predicted label |
| Return to captured timestamp | Preserved when closing the panel |
| Missing currency / condition / availability | Remain unknown instead of filling in defaults |

Local gallery-first navigation, toolbar-only activation, on-video SAM contours, evidence profiles, caption/context input, additional image views, Same function intent, variant resolution warnings, cache/stale-request protection, source-bound capture access and setup workflow are retained.

## Intentional differences

- No floating Explore button or controls over the video. Toolbar activation opens the all-items grid; selection opens details; back returns to the grid.
- Extra sorting, budget/brand filters and lower-priced mode are grouped in More search options to avoid overwhelming the main flow.
- Deeper photo/text assessments supplement main's listing-text labels, never claim verified exact identity.
- Outbound retailer/image URLs require HTTPS. HTTP-only URLs do not become clickable offers/images.
- Search requests retain main's 12-result limit; backend caps at 30 to match the supported provider limit.
- No payments, rentals, automatic compatibility rejection, production deployment or personalization profile were added in this merge.

## Validation

- 52 unit/API tests passed, including incoming-main cases and local recognition/profile/segmentation cases.
- JavaScript/manifest checks and extension build passed.
- Real isolated Chrome with mocked provider responses passed the combined gallery/details/back flow, no on-video controls, save/remove and stored wishlist verification, three-comparison limit, mixed-currency warning, sorting within a currency, budget presets, lower-priced mode, variant substitution, cached profiles, stale-response suppression, caption handling, additional view upload, export, cross-tab capture rejection, resize/letterbox positioning, playback handling and panel close.
- One real Gemini inference accepted the merged recognition schema, returned separate colour fields, and left silhouette refinement to the dedicated segmentation endpoint. The synthetic input is not a model-quality benchmark.
- Provider credentials, local captures, browser profiles, node_modules and model weights remain ignored.

These checks cover the exercised flows; they do not guarantee every video site or product category. The broader local-live report documents the previous segmentation/catalog smoke test separately.
