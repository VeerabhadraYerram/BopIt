export function profileErrorMessage(error) {
  if (error instanceof TypeError) return 'BopIt could not reach the local server. Start it with npm start, then try again.';
  if (error?.code === 'KEY_MISSING') return 'Gemini is not configured on the local server. Check the server setup, then try again.';
  if (error?.status === 429 || error?.code === 'PROVIDER_RATE_LIMIT') return 'Gemini is rate-limited right now. Wait a little, then retry the investigation.';
  if (error?.status === 413 || error?.code === 'REQUEST_TOO_LARGE') return 'This selection is too large to analyze. Choose a smaller area or remove an extra image.';
  if (['INVALID_CROP_IMAGE', 'INVALID_SCENE_IMAGE', 'INVALID_ADDITIONAL_IMAGE'].includes(error?.code)) {
    return 'BopIt could not read one of these images. Select the object again or remove the extra image and retry.';
  }
  if (error?.code === 'PROFILE_TIMEOUT') return 'Gemini took too long to analyze this selection. Try again with a smaller area.';
  return 'Gemini could not complete this investigation. Check your connection and try again.';
}

export function channel3ErrorMessage(error, action = 'this request') {
  if (error instanceof TypeError) return 'BopIt could not reach the local server. Start it with npm start, then try again.';
  if (error?.code === 'KEY_MISSING') return 'Channel3 is not configured on the local server. Check the server setup, then try again.';
  if (error?.status === 429) return 'Channel3 is rate-limited right now. Wait a little, then try again.';
  if (error?.status === 413 || error?.code === 'REQUEST_TOO_LARGE') return 'This request is too large. Remove extra images or try again.';
  return `Channel3 could not complete ${action}. Check your connection or try again in a moment.`;
}

export function searchErrorMessage(error) {
  return channel3ErrorMessage(error, 'the search');
}
