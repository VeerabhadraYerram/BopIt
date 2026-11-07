# Moment-first experience

The viewer controls activation through the Chrome toolbar or its keyboard shortcut. A pause alone never shows UI or uploads a frame.

## Navigation

1. Toolbar activation captures the paused moment and opens the panel while scanning runs on the video.
2. The panel shows a small loading skeleton until real detections arrive; no fake percentage or invented item count.
3. Real detections become a two-column grid with large crop thumbnails, names and generous clickable surfaces.
4. Selecting a card or video contour switches to a dedicated object-details screen.
5. A persistent “← All items” button restores the list without requiring a new scan. Completed profiles/searches remain cached.
6. Closing the panel or pressing Escape removes the exploration overlays. Resuming playback hides stale contours while preserving access to the captured moment in the panel.

The video contains only scan feedback, predicted contours, or small fallback markers. There are no All items, Select an area, Close highlights or floating Explore buttons over the video. This removes the original hit-testing conflict where a large object button could sit above the video toolbar. Manual corrections remain an advanced panel-only fallback, not the main interaction.

## Visual decisions

Warm cream background, muted sage highlights, peach selection accents, rounded crop cards, quiet borders and a few decorative flower marks provide character without covering the video. The gallery prioritizes recognition and selection; deeper evidence and specifications remain expandable within the selected item.

Panel entry and item appearance use short 150–220 ms transitions. These timings are our design choices, not benchmarked optimal values. Animation is for orientation/loading feedback and never delays a user action. Reduced-motion preferences disable decorative motion; keyboard focus stays visible. The back button remains in the sticky panel header.

## Object outlines

Live inspection found that VLM-generated polygons could cut across empty space. They were rejected for the primary experience. Gemini now returns labels and boxes; a separate backend API runs box-prompted **SlimSAM** and traces the raster mask boundary, retaining holes and disconnected parts as SVG subpaths. Even-odd fill ensures holes are not clickable foreground.

Recognition results populate the list immediately, with small markers while outlines are refined asynchronously. Segmentation failure preserves the item list and markers. The module runs on the developer backend today and can run on a hosted backend; users do not install a model. The current localhost configuration is development-only, not a completed production deployment.

These contours remain estimates: occlusion, small items and imperfect localization affect segmentation. Exact pixel boundaries are not guaranteed.

## Research references

- [Google image understanding](https://ai.google.dev/gemini-api/docs/image-understanding): detection and segmentation outputs. Used to choose the polygon-output contract with the existing provider.
- [MDN pointer events](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/pointer-events): SVG shape hit-testing and descendant event targeting. Used for interactive shape interiors without an invisible full-frame hit target.
- [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): minimum targets and equivalent controls. Item cards provide a large alternative for tiny on-video targets; important panel controls exceed the 24 px minimum.
- [Chrome motion guidance](https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/motion) and [W3C reduced-motion technique](https://www.w3.org/WAI/WCAG22/Techniques/css/C39): respect motion preferences and remove unnecessary animation.

These choices have functional browser tests and visual inspection, but are not a substitute for user usability studies or a WCAG conformance audit.

- [Transformers.js SAM API](https://huggingface.co/docs/transformers.js/v3.8.1/api/models): the implementation uses box prompts and shares image embeddings across detected items.
