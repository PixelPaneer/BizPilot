// The Settings page's calls to the backend (/api/v1/settings/*). The API uses snake_case column
// names; each function here converts to and from the names the Settings screens use.
import { apiRequest } from './apiClient'

const THEME_FROM_API = { light: 'Light', dark: 'Dark' }
const THEME_TO_API = { Light: 'light', Dark: 'dark' }

// ---- preferences (GET / PATCH /settings) ----

export async function fetchSettings() {
  return apiRequest('/settings')
}

export function saveSettings(changes) {
  return apiRequest('/settings', { method: 'PATCH', body: changes })
}

export function toInventoryPreferences(settings) {
  return {
    stockAlerts: settings.stock_alerts_enabled,
    lowStockAlerts: settings.low_stock_alerts_enabled,
    outOfStockAlerts: settings.out_of_stock_alerts_enabled,
  }
}

export function fromInventoryPreferences(preferences) {
  return {
    stock_alerts_enabled: preferences.stockAlerts,
    low_stock_alerts_enabled: preferences.lowStockAlerts,
    out_of_stock_alerts_enabled: preferences.outOfStockAlerts,
  }
}

export function toNotificationPreferences(settings) {
  return {
    inApp: settings.in_app_notifications_enabled,
    email: settings.email_notifications_enabled,
    lowStock: settings.notification_low_stock_enabled,
    outOfStock: settings.notification_out_of_stock_enabled,
    frequency: settings.report_frequency,
  }
}

export function fromNotificationPreferences(preferences) {
  return {
    in_app_notifications_enabled: preferences.inApp,
    email_notifications_enabled: preferences.email,
    notification_low_stock_enabled: preferences.lowStock,
    notification_out_of_stock_enabled: preferences.outOfStock,
    report_frequency: preferences.frequency,
  }
}

export function toLanguagePreferences(settings) {
  return {
    language: settings.dashboard_language,
    theme: THEME_FROM_API[settings.appearance_theme] ?? 'Light',
    dateFormat: settings.date_format,
  }
}

export function fromLanguagePreferences(preferences) {
  return {
    dashboard_language: preferences.language,
    appearance_theme: THEME_TO_API[preferences.theme] ?? 'light',
    date_format: preferences.dateFormat,
  }
}

// ---- business profile (GET / PUT /settings/profile, POST /settings/profile/logo) ----

export function toBusinessProfile(row) {
  return {
    businessName: row.business_name ?? '',
    businessType: row.business_type ?? '',
    ownerName: row.owner_name ?? '',
    contact: row.contact_number ?? '',
    email: row.business_email ?? '',
    address: row.business_address ?? '',
    description: row.business_description ?? '',
    gstin: row.gstin ?? '',
    logo: row.business_logo_url ?? '',
  }
}

export async function fetchBusinessProfile() {
  return toBusinessProfile(await apiRequest('/settings/profile'))
}

// The profile is saved as a whole, so the GSTIN (which has no field on this form) is sent back
// unchanged instead of being cleared.
export async function saveBusinessProfile(profile) {
  const row = await apiRequest('/settings/profile', {
    method: 'PUT',
    body: {
      business_name: profile.businessName.trim(),
      business_type: profile.businessType,
      owner_name: profile.ownerName.trim(),
      contact_number: profile.contact.trim(),
      business_email: profile.email.trim(),
      business_address: profile.address.trim(),
      business_description: profile.description.trim() || null,
      gstin: profile.gstin || null,
    },
  })
  return toBusinessProfile(row)
}

// Uploads the logo file and returns its new URL.
export async function uploadBusinessLogo(file) {
  const body = new FormData()
  body.append('logo', file)
  const row = await apiRequest('/settings/profile/logo', { method: 'POST', body })
  return row.business_logo_url
}

// ---- password (PUT /settings/account/password) ----

export function changePassword(currentPassword, newPassword) {
  return apiRequest('/settings/account/password', {
    method: 'PUT',
    body: { currentPassword, newPassword },
  })
}
