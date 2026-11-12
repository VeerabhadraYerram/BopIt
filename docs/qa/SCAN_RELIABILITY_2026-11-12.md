# Scan reliability and setup UX — 12 November 2026

## Scan changes

- The initial scan keeps the original image resolution, pixel data, object limit and complete recognition schema. No lower-resolution preview or reduced-detail recognition response is substituted.
- Validated PNGs above 256 KB are recompressed losslessly. Every decoded pixel and image dimension stays unchanged. If recompression does not save bytes, the original is used. This reduces upload size where possible; it does not guarantee lower inference latency.
- A successful identical-frame detection can be reused for five minutes. The cache is memory-only, holds at most eight results, and is scoped to the extension origin, frame contents and model configuration. It stores detection results, not image files. New responses retain the requesting capture ID. Failed results are never cached.
- Concurrent requests for the identical frame share one provider operation. Different frames keep the existing concurrency/rate limits.
- Initial detection has an optional backup model. The backup starts if the primary returns a transient service/network error or has not completed after twelve seconds. The first fully parsed and schema-validated response wins; the losing request is aborted. There are at most two provider attempts within the original 45-second overall deadline. Fast primary responses start no backup. After a successful backup response or a provider timeout/503, subsequent new scans briefly avoid the unavailable primary model for thirty seconds.
- Authentication, access and quota errors on the primary do not trigger backup calls. No private provider response body is exposed.
- The default backup is gemini-3.1-flash-lite, which was listed as available and returned validated detections using the current API key during live verification. Set GEMINI_FALLBACK_MODEL in the server environment to choose another available image/structured-output model; set it to an empty value to disable backup. Detailed object profiling, speech, shopping, outlines and payments retain their existing paths.
- Backup requests can incur an additional API charge. Model outputs remain probabilistic: preserving pixels and schema is not a guarantee that two models identify exactly the same objects. A wider Gemini outage can still produce a final error.

## Setup UX included in this update

The prominent three-way match tab bar is replaced by an optional **Change what to match** control with plain-language descriptions. Closest-match, appearance and same-purpose searches are retained.

**Recreate this setup** has a focused view with cropped item selections, a live count, optional total budget, Build my setup, Stop searching, grouped product results and expandable additional options. Back restores the original product results and scroll position without a request. Existing item details, price graphs, seller navigation, cart, audio and inline checkout are retained.

The six-item cap is removed from selection, request validation and budget planning. Every detected item can be included. Searches still run at most two at a time and budget candidate selection uses a bounded beam; a partial result is shown when a complete set is not found among the retrieved candidates. This is not an exhaustive global price or compatibility guarantee.

## Verification

- 146 server and contract tests passed.
- New tests verify busy-primary recovery, equal image/prompt/schema across models, slow-primary backup, cancellation of the losing attempt, invalid-output rejection, no quota/auth retry, overall deadline, pixel-identical PNG recompression, shared requests and cached capture identity.
- Setup regression covers 24-item budget planning and eight selected items through Chrome, including selection, cancellation and returning to previous results.
- Chrome shopping, full video/audio/outline interaction and mocked PayPal checkout/receipt/recovery tests passed.
- Live alternatives tested on the synthetic frame: gemini-3.1-flash-lite returned two valid objects in 5.4 seconds; gemini-2.5-flash returned two in 12.3 seconds. Both Gemini 3.5 versions returned 503 during the earlier live check. These are single observations on a synthetic image, not production latency or model-accuracy benchmarks.
- The live endpoint initially timed out during the provider outage; a retry succeeded through the backup model in 17.4 seconds. The next identical-frame request was served from cache in 20 milliseconds. These are observed samples, not latency guarantees.
- A same-model comparison of two API keys produced two successful responses for the new key (22.0 seconds and 2.2 seconds) and two 503 responses for the existing key. The new key is configured locally as primary and the existing key as backup. Recognition, profiling, comparison, speech and preference interpretation can use backup credentials for transient service errors. Primary quota/authentication failures do not trigger credential rotation. Keys belonging to the same project may share quotas and availability. Neither credential is committed.
- Live endpoint/cache timing evidence is kept locally in .local/scan-recovery-live-audit.json; it contains no API key or source image.

## References

- Gemini service errors and backoff: https://ai.google.dev/gemini-api/docs/api-errors
- Media resolution trades latency against detail: https://ai.google.dev/gemini-api/docs/media-resolution
