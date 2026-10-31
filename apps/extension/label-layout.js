// Place a tooltip inside the image, even when its detection touches an edge.
export function clampLabel(label, anchor, stage, inset = 4) {
  return {
    left: Math.max(inset, Math.min(anchor.x + inset, stage.width - label.width - inset)) - anchor.x,
    top: Math.max(inset, Math.min(anchor.y + inset, stage.height - label.height - inset)) - anchor.y
  };
}
