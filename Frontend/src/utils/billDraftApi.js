import { apiRequest } from './apiClient'
import { buildBillForm } from './billForm'

// Sends a voice note (`{ audio }`) or a bill photo (`{ image }`) to the server, which reads it into
// an editable draft. `type` (SALE or PURCHASE) is the owner's own answer when they gave one.
// Nothing is saved: stock only changes when the owner confirms the list.
// Resolves to { type, lines, warnings } (see docs/API_CONTRACT.md, section 6).
export function extractBillDraft(input) {
  return apiRequest('/bills/extract', { method: 'POST', body: buildBillForm(input) })
}
