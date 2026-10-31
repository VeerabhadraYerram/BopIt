import test from 'node:test';
import assert from 'node:assert/strict';
import { clampLabel } from '../apps/extension/label-layout.js';
test('labels stay inside all image edges, including a bottom-right small box', () => {
  const stage = { width: 400, height: 225 }, label = { width: 180, height: 42 };
  for (const anchor of [{ x: 0, y: 0 }, { x: 395, y: 0 }, { x: 0, y: 220 }, { x: 395, y: 220 }]) {
    const offset = clampLabel(label, anchor, stage);
    assert.ok(anchor.x + offset.left >= 4);
    assert.ok(anchor.y + offset.top >= 4);
    assert.ok(anchor.x + offset.left + label.width <= stage.width - 4);
    assert.ok(anchor.y + offset.top + label.height <= stage.height - 4);
  }
});
