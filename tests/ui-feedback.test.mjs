import test from 'node:test';
import assert from 'node:assert/strict';
import { profileErrorMessage, searchErrorMessage } from '../apps/extension/ui-feedback.mjs';

test('profile errors give a safe, actionable message for known failure classes', () => {
  assert.match(profileErrorMessage(new TypeError('private network detail')), /Start it with npm start/);
  assert.match(profileErrorMessage({ code: 'INVALID_CROP_IMAGE' }), /Select the object again/);
  assert.match(profileErrorMessage({ status: 413 }), /smaller area/);
  assert.match(profileErrorMessage({ status: 429 }), /Wait a little/);
  assert.match(profileErrorMessage({ code: 'PROFILE_TIMEOUT' }), /smaller area/);
  assert.doesNotMatch(profileErrorMessage({ code: 'PROFILE_ANALYSIS_FAILED', message: 'secret provider detail' }), /secret/);
});

test('Channel3 errors are actionable without exposing provider response details', () => {
  assert.match(searchErrorMessage({ status: 429 }), /Wait a little/);
  assert.match(searchErrorMessage({ code: 'KEY_MISSING' }), /Channel3 is not configured/);
  assert.doesNotMatch(searchErrorMessage({ status: 502, message: 'private upstream response' }), /private/);
});
