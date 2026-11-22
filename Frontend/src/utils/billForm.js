// The multipart form sent to POST /bills/extract: exactly one file, `audio` (a voice note) or `image`
// (a bill photo), and optionally `type`, the owner's own answer to "is this a sale or a purchase?",
// which the server uses instead of its own guess. Any other value is left out, so "let the app decide"
// simply sends no type.
export function buildBillForm({ audio, image, type }) {
  const file = audio ?? image
  const form = new FormData()
  form.append(audio ? 'audio' : 'image', file, file.name || (audio ? 'voice-note' : 'bill.jpg'))
  if (type === 'SALE' || type === 'PURCHASE') form.append('type', type)
  return form
}
