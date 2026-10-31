# Recognition evaluation: how to assess the first slice

This prototype is an instrument for evaluating VLM detection, not an established high-accuracy product detector.

## Build the dataset

Use 50–100 authorized paused frames. Include clear prominent objects, small accessories, camera/lens attachment, overlaps, furniture/clothing/electronics, clutter, blur, hidden labels, and no-useful-object examples. Do not use only the same canonical demo scene.

For each image, annotate generic category, normalized x/y/width/height, visibility/occlusion, ambiguity, and whether the object should reasonably be selectable. Decide in advance when a camera and lens should have separate annotations. Record capture quality separately from model localization. Split development and held-out test frames; do not tune the prompt against the test set.

Keep images/exports locally under ignored `test-results/` until their publication rights and privacy are clear. Never commit API keys or pairing codes with evaluation data.

## Run an evaluation

1. Upload the image in the inspector. Run full-frame detection exactly once and export the result before making corrections.
2. Record exact model ID, prompt/version commit, image dimensions, elapsed time, account/quota conditions, date, and any provider failure.
3. Match predictions one-to-one to human labels using the same category conventions and a predeclared bounding-box overlap threshold (start with IoU ≥ 0.5; also inspect a stricter threshold).
4. Report false positives and missed relevant objects separately. Do not count two duplicate boxes as two true positives.
5. For failed small/attached objects, run crop refinement as a separate experiment. Record whether the crop was user-provided or model-proposed. Do not compare a corrected second-pass result with another model's uncorrected first pass without labeling the difference.
6. Measure selection success with humans: can they choose the intended item from boxes or the accessible list without manual correction? Nested boxes need this practical check even if their IoU is acceptable.

## Required report

| Metric | Definition |
| --- | --- |
| Precision | Correct matched detections / all detections |
| Recall | Correct matched detections / all annotated relevant objects |
| Localization | Matched box IoU distribution, not only an average |
| Selection success | Intended item selectable without correction / selection attempts |
| Correction rate | Attempts requiring manual region/label edits / attempts |
| Latency | Median and slow-case full-frame and crop-refinement request times |
| Failure rate | Timeouts, invalid outputs and provider errors / requests |

Break results down by small objects, attached components, clutter and clear frames. Report sample counts and uncertainty. Generic category correctness is separate from exact product/model identity; no SKU accuracy claim is supported by this slice.

Model-supplied confidence is not calibrated probability. Repeated VLM agreement does not independently verify a fact. Runtime schema validation proves response shape, not semantic correctness. Empty responses and failures remain failures or legitimate empty scenes according to the annotations; never silently replace them with fixtures.
