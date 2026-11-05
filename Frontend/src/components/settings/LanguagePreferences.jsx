
import { useState } from "react";
import {
  Languages,
  Palette,
  CalendarDays,
  Save,
  RotateCcw
} from "lucide-react";

import "./LanguagePreferences.css";

const defaultPreferences = {
  language: "English",
  theme: "Light",
  dateFormat: "DD/MM/YYYY"
};

const translations = {
  English: {
    title: "Language & Preferences",
    subtitle: "Customize your dashboard language and appearance.",
    dashboardLanguage: "Dashboard Language",
    languageDescription: "Select your preferred dashboard language.",
    appearance: "Appearance",
    appearanceDescription: "Choose how your dashboard looks.",
    light: "Light Theme",
    dark: "Dark Theme",
    dateFormat: "Date Format",
    dateDescription: "Select your preferred date display format.",
    cancel: "Cancel",
    save: "Save Changes",
    success: "Language and preferences saved successfully!",
    error: "Unable to save preferences."
  },

  Hindi: {
    title: "भाषा और प्राथमिकताएँ",
    subtitle: "अपने डैशबोर्ड की भाषा और दिखावट बदलें।",
    dashboardLanguage: "डैशबोर्ड की भाषा",
    languageDescription: "अपनी पसंदीदा डैशबोर्ड भाषा चुनें।",
    appearance: "दिखावट",
    appearanceDescription: "अपने डैशबोर्ड की थीम चुनें।",
    light: "लाइट थीम",
    dark: "डार्क थीम",
    dateFormat: "तारीख का प्रारूप",
    dateDescription: "तारीख दिखाने का पसंदीदा प्रारूप चुनें।",
    cancel: "रद्द करें",
    save: "बदलाव सेव करें",
    success: "भाषा और प्राथमिकताएँ सफलतापूर्वक सेव हो गईं!",
    error: "प्राथमिकताएँ सेव नहीं हो पाईं।"
  },

  Hinglish: {
    title: "Language aur Preferences",
    subtitle: "Apne dashboard ki language aur appearance customize karein.",
    dashboardLanguage: "Dashboard Language",
    languageDescription: "Apni preferred dashboard language select karein.",
    appearance: "Appearance",
    appearanceDescription: "Apne dashboard ki theme choose karein.",
    light: "Light Theme",
    dark: "Dark Theme",
    dateFormat: "Date Format",
    dateDescription: "Apna preferred date display format select karein.",
    cancel: "Cancel Karein",
    save: "Changes Save Karein",
    success: "Language aur preferences successfully save ho gayi!",
    error: "Preferences save nahi ho payi."
  }
};

function LanguagePreferences({ language = "English", onLanguageChange }) {

  const t = translations[language] || translations.English;

  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem("bizpilot-language-preferences");
      return saved
        ? { ...defaultPreferences, ...JSON.parse(saved) }
        : defaultPreferences;
    } catch {
      return defaultPreferences;
    }
  });

  const [savedPreferences, setSavedPreferences] = useState(preferences);
  const [message, setMessage] = useState("");

  const handleChange = (name, value) => {
    setPreferences((prev) => ({
      ...prev,
      [name]: value
    }));

    setMessage("");
  };

  const handleSave = () => {
    try {
      localStorage.setItem(
        "bizpilot-language-preferences",
        JSON.stringify(preferences)
      );

      document.documentElement.setAttribute(
        "data-theme",
        preferences.theme.toLowerCase()
      );

      setSavedPreferences(preferences);

      if (onLanguageChange) {
        onLanguageChange(preferences.language);
      }

      const selectedTranslation =
        translations[preferences.language] || translations.English;

      setMessage(selectedTranslation.success);

    } catch {
      setMessage(t.error);
    }
  };

  const handleCancel = () => {
    setPreferences(savedPreferences);
    setMessage("");
  };

  return (
    <div className="language-preferences">

      {/* Section Heading */}
      <div className="section-intro">
        <div className="section-icon">
          <Languages size={22} />
        </div>

        <div>
          <h3>{t.title}</h3>
          <p>{t.subtitle}</p>
        </div>
      </div>

      {/* Language */}
      <div className="language-setting-card">

        <div className="language-setting-heading">
          <Languages size={19} />

          <div>
            <h4>{t.dashboardLanguage}</h4>
            <p>{t.languageDescription}</p>
          </div>
        </div>

        <div className="language-options">

          {["English", "Hindi", "Hinglish"].map((lang) => (
            <button
              type="button"
              key={lang}
              className={`language-option ${
                preferences.language === lang ? "active" : ""
              }`}
              onClick={() => handleChange("language", lang)}
            >
              {lang}
              {preferences.language === lang && " ✓"}
            </button>
          ))}

        </div>

      </div>

      {/* Theme */}
      <div className="language-setting-card">

        <div className="language-setting-heading">
          <Palette size={19} />

          <div>
            <h4>{t.appearance}</h4>
            <p>{t.appearanceDescription}</p>
          </div>
        </div>

        <div className="theme-options">

          <button
            type="button"
            className={`theme-option ${
              preferences.theme === "Light" ? "active" : ""
            }`}
            onClick={() => handleChange("theme", "Light")}
          >
            <div className="theme-preview light-preview">
              <span></span>
              <span></span>
              <span></span>
            </div>

            <span>{t.light}</span>
          </button>

          <button
            type="button"
            className={`theme-option ${
              preferences.theme === "Dark" ? "active" : ""
            }`}
            onClick={() => handleChange("theme", "Dark")}
          >
            <div className="theme-preview dark-preview">
              <span></span>
              <span></span>
              <span></span>
            </div>

            <span>{t.dark}</span>
          </button>

        </div>

      </div>

      {/* Date Format */}
      <div className="language-setting-card">

        <div className="language-setting-heading">
          <CalendarDays size={19} />

          <div>
            <h4>{t.dateFormat}</h4>
            <p>{t.dateDescription}</p>
          </div>
        </div>

        <select
          className="date-format-select"
          value={preferences.dateFormat}
          onChange={(e) => handleChange("dateFormat", e.target.value)}
        >
          <option value="DD/MM/YYYY">
            DD/MM/YYYY (01/11/2026)
          </option>

          <option value="MM/DD/YYYY">
            MM/DD/YYYY (11/01/2026)
          </option>

          <option value="YYYY-MM-DD">
            YYYY-MM-DD (2026-11-01)
          </option>
        </select>

      </div>

      {/* Message */}
      {message && (
        <p className="preference-message" role="status">
          {message}
        </p>
      )}

      {/* Actions */}
      <div className="profile-actions">

        <button
          type="button"
          className="profile-cancel-btn"
          onClick={handleCancel}
        >
          <RotateCcw size={16} />
          {t.cancel}
        </button>

        <button
          type="button"
          className="profile-save-btn"
          onClick={handleSave}
        >
          <Save size={16} />
          {t.save}
        </button>

      </div>

    </div>
  );
}

export default LanguagePreferences;
