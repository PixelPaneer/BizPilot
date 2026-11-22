import { apiRequest } from './apiClient'

// Sends a voice note (`{ audio }`) or a bill photo (`{ image }`) to the server, which reads it into
// an editable draft. Nothing is saved: stock only changes when the owner confirms the list.
// Resolves to { type, lines, warnings } (see docs/API_CONTRACT.md, section 6).
export function extractBillDraft({ audio, image }) {
  const file = audio ?? image
  const form = new FormData()
  form.append(audio ? 'audio' : 'image', file, file.name || (audio ? 'voice-note' : 'bill.jpg'))
  return apiRequest('/bills/extract', { method: 'POST', body: form })
}
