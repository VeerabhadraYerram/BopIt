# BopIt submission plan

Prepared 10 November 2026 against main dc32d44. This is a proposed deadline-focused plan, not a claim that new features have shipped or that a prize is guaranteed. It narrows the broader PayPal roadmap for this submission.

## Verified competition facts

The submission deadline is 12 November 2026 at noon PST, equivalent to **13 November 2026 at 01:30 IST**. Use **12 November at 18:00 IST** as the team's proposed submission target to leave a buffer.

Implementation, design, potential impact, innovation and presentation are equally weighted. PayPal must be central and AI meaningful. A functional build, public open-source repository, run instructions or hosted access, and a publicly visible YouTube demonstration under three minutes are required. Judges can evaluate the submitted materials without running the app. Access must remain available through the judging period, which ends 15 December 2026.

Sources: [official rules](https://paypalaihackathon.devpost.com/rules), [challenge page](https://paypalaihackathon.devpost.com/). Check these again before submission for amendments. These are summaries, not additional requirements invented by the team.

## Positioning

Proposed pitch: **BopIt turns a paused video into a budget-aware shopping plan, explains the tradeoffs, and carries the chosen items through a verified PayPal Sandbox payment.**

Initial audience: beginner video creators trying to recreate an affordable desk/lighting setup from a tutorial. This gives the demo concrete needs, several objects, alternatives, a budget and a reason to use a cart. Treat audience demand as a hypothesis until tested.

Do not claim novelty simply from detecting products in videos. Demonstrate the combination of visual context, functional substitutions, budget planning, evidence and reliable payment recovery. Do not claim universal exact identification or autonomous purchasing.

## Rubric-to-work map

| Criterion | Existing strength | Highest-value remaining evidence/change |
| --- | --- | --- |
| Implementation | Recognition, segmentation, Channel3 tools, signed quotes, verified capture; 78 tests passed in the previous local review | Demonstrate the exact current cart in a live Sandbox capture; add persistent receipts and one refund path |
| Design | On-video selection, item gallery, contextual panel, preserved source moment | One clear plan/review/pay journey with advanced features progressively disclosed |
| Impact | Budget and functional alternatives are already represented | Observe five target users; compare task completion and time with manual searching |
| Innovation | Scene-based discovery and commerce in the video context | Explicit constraints, visible tool actions and a meaningful plan revision |
| Presentation | Runnable extension and existing test/demo harnesses | 170-second functioning Chrome demo with a coherent beginning, purchase and resolution |

These priorities are recommendations, not predictions of judging scores.

## Build in this order

### 1. Make one task effortless

Add or consolidate an object-panel action: **Build this setup**. Start with detected objects already available in the current frame. Let the viewer select roles, enter total budget and market, and supply one requirement such as a small desk. Reuse current scene planning, product retrieval, variant selection and cart code.

Show a concise plan: included roles, selected listing and variant, evidence-backed reason, price/currency, missing facts and total. A budget is a hard deterministic check. Keep unknown delivery, stock and compatibility explicit. Let the user replace an item without rebuilding the whole cart.

The current scene planner searches roles and chooses affordable candidates; do not call that an autonomous reasoning loop. For a stronger agentic story, add a bounded sequence in which the model proposes queries/alternatives and chooses an allowed next tool based on results. Enforce tool/request budgets, supported operations and totals in code. Stop with an honest partial result when constraints cannot be met.

Example action trace: inspected three selected objects → searched listings → retrieved chosen variants → checked total → replaced the over-budget option → awaiting your approval. Every entry must correspond to an actual operation. No decorative or fabricated reasoning trace. Never let model output directly execute payment or set trusted prices.

Acceptance: budget change from one amount to a lower amount visibly changes the proposed plan; total meets the selected currency/budget or the app explains why it cannot. Stale responses cannot overwrite newer requirements.

### 2. Complete a compact PayPal lifecycle

Reuse the existing signed quote and verified capture. Add durable owned order/receipt storage, a way back from the object/source moment, and one authenticated full or partial Sandbox refund workflow. Refund policy/authority must be explicit; keep payment and refund statuses separate and reconcile pending results.

Acceptance: selected cart → fresh quote → buyer approval → independently verified capture → reload/restart recovery → eligible refund → provider-confirmed refund status. Lost responses and repeated clicks must not duplicate financial operations. Complete the actual current multi-item capture; earlier live evidence for another flow does not prove this exact revision.

Use a small controlled demo merchant/catalog for integrated order fulfillment if available. Otherwise describe the exact implemented scope as payment simulation. Do not claim that paying BopIt orders Channel3 retailer inventory. Real retailer clickout remains available.

A verified PayPal webhook receiver is a stretch addition after persistence/refunds work, and needs public HTTPS ingress. SDK payment choices are also stretch work. Do not let wallet/account eligibility delay a demonstrable core transaction.

### 3. Make the UI and setup judge-friendly

Default view: selected object → proposed plan → review cart → checkout. Move taxonomy controls, conversation, reporting and detailed evidence behind secondary controls. Use clear loading, cancellation, retry and unknown-result states. Preserve keyboard navigation and the original video timestamp.

Write a short judge quickstart that someone else tests on a clean environment. Include dependency installation, model download/warm-up, extension loading, pairing and exact supported flow. Resolve stale setup prose that describes a preview-before-upload flow if activation actually sends the frame immediately. Do not expose production credentials in a public repo. Provide dedicated restricted test access through an appropriate judge channel, or exact instructions for obtaining access.

Hosting can reduce friction but the rules permit a local runnable build. Treat remote service configuration/authentication as real implementation work, not just changing a URL. Keep a working local path if deployment risks the submission.

### 4. Collect evidence before adding another feature

- Record ten authorized unseen frames across varied scenes; annotate relevant items, misses, wrong suggestions and latency. Report measured results with denominators and limitations. This is an initial evaluation, not a universal accuracy claim.
- Have five target users attempt the same affordable-setup task manually and with BopIt. Alternate task/order where feasible to reduce learning bias. Record completion, time, corrections, misunderstandings and a short satisfaction answer. A small convenience sample supports observations, not market-wide proof.
- Test the exact filmed path three consecutive times with live Gemini/Channel3 and PayPal Sandbox. Keep sanitized evidence distinguishing created, approved, captured and refunded states.
- Use self-shot or otherwise authorized footage. Existing catalog-photo videos are useful integration tests but weak evidence of recognition on unseen real footage.

## Cut line

Defer rental booking, creator payouts, subscriptions, multi-seller settlement, every wallet, a new merchant dashboard and unrelated sponsor integrations until after the deadline. They introduce substantial state/account dependencies. They can be discussed as future work, never shown as completed functionality.

If the core loop is unreliable by the end of 11 November, freeze new features and spend the remaining time on repairs, evaluation, judge setup and the recording. A functioning simpler flow is preferable to a plan-heavy demo of unfinished features.

## Suggested schedule in IST

| Date | Outcome |
| --- | --- |
| 10 November | Freeze story; implement constrained plan/revision; confirm live Sandbox access immediately |
| 11 November | Finish durable receipt/refund, relevant failure tests and three successful end-to-end rehearsals; begin user checks |
| 12 November morning | Freeze code; clean-machine setup; finalize evidence, submission copy and recording |
| 12 November by 18:00 | Target submission; verify public video/repo and judge access; preserve buffer until official cutoff |

## 170-second video storyboard

| Time | On-screen evidence |
| --- | --- |
| 0-15s | Self-shot tutorial paused in Chrome; explain the beginner's problem and budget |
| 15-40s | Click BopIt, see recognition and select relevant setup items |
| 40-75s | Build the plan; show functional alternatives and change one budget/requirement |
| 75-100s | Review selected variants and server-refreshed total; distinguish guesses from catalog facts |
| 100-135s | Actual Sandbox buyer approval and verified cart receipt; keep test-payment scope visible |
| 135-155s | Receipt recovery or a confirmed refund, if implemented; return to the source moment |
| 155-170s | One measured user result if available, concise architecture, and how judges can run it |

Use readable screen capture and narration. Label any time compression. Avoid an opening logo sequence, long slide deck, unsupported accuracy claims or a tour of every control. Never replace a failed provider action with an unlabeled successful fixture. The recording must show the actual extension on its intended device.

## Submission focus

Aim the narrative at overall excellence, meaningful PayPal + AI, useful agentic commerce and demo delivery. Channel3 is the natural sponsor-prize fit because it is already central. The rules allow at most one grand prize plus one sponsor prize OR one honorable mention plus one sponsor prize; do not plan on stacking all special awards.

Describe what was built during the hackathon, tools and actual roles, architecture, testing evidence, limitations and next steps. Keep the public license visible. Verify that the video is under three minutes and public. Preserve a release commit matching the video and keep the tested build/access usable through judging.

The best next engineering slice is **Build this setup → revise a constraint → review cart → verified Sandbox receipt → recover/refund**. Measure whether a beginner can finish it without assistance.
