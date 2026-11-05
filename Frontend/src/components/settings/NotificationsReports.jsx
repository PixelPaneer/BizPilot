import { useState } from "react";
import { Bell, Mail, FileText, Save, RotateCcw } from "lucide-react";
import "./NotificationsReports.css";

const translations = {
  English: {
    title: "Notifications & Reports",
    subtitle: "Manage how you receive alerts and business reports.",
    notificationSettings: "Notification Preferences",
    inApp: "In-App Notifications",
    inAppDesc: "Receive alerts inside your BizPilot dashboard.",
    email: "Email Notifications",
    emailDesc: "Receive important business alerts through email.",
    lowStock: "Low Stock Alerts",
    lowStockDesc: "Get notified when product stock reaches the minimum threshold.",
    outOfStock: "Out of Stock Alerts",
    outOfStockDesc: "Get notified when a product is completely out of stock.",
    reports: "Report Preferences",
    frequency: "Report Frequency",
    frequencyDesc: "Choose how often you want to receive business reports.",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    save: "Save Changes",
    cancel: "Reset",
    saved: "Notification preferences saved successfully!",
  },
  Hindi: {
    title: "सूचनाएं और रिपोर्ट",
    subtitle: "अलर्ट और बिजनेस रिपोर्ट प्राप्त करने की सेटिंग बदलें।",
    notificationSettings: "नोटिफिकेशन प्राथमिकताएं",
    inApp: "ऐप नोटिफिकेशन",
    inAppDesc: "BizPilot डैशबोर्ड के अंदर अलर्ट प्राप्त करें।",
    email: "ईमेल नोटिफिकेशन",
    emailDesc: "ईमेल के माध्यम से महत्वपूर्ण बिजनेस अलर्ट प्राप्त करें।",
    lowStock: "कम स्टॉक अलर्ट",
    lowStockDesc: "स्टॉक कम होने पर नोटिफिकेशन प्राप्त करें।",
    outOfStock: "स्टॉक खत्म होने का अलर्ट",
    outOfStockDesc: "प्रोडक्ट का स्टॉक खत्म होने पर नोटिफिकेशन प्राप्त करें।",
    reports: "रिपोर्ट प्राथमिकताएं",
    frequency: "रिपोर्ट की आवृत्ति",
    frequencyDesc: "चुनें कि आपको कितनी बार बिजनेस रिपोर्ट चाहिए।",
    daily: "रोजाना",
    weekly: "साप्ताहिक",
    monthly: "मासिक",
    save: "बदलाव सेव करें",
    cancel: "रीसेट करें",
    saved: "नोटिफिकेशन सेटिंग सेव हो गई!",
  },
  Hinglish: {
    title: "Notifications & Reports",
    subtitle: "Alerts aur business reports ki settings manage karein.",
    notificationSettings: "Notification Preferences",
    inApp: "In-App Notifications",
    inAppDesc: "BizPilot dashboard ke andar alerts receive karein.",
    email: "Email Notifications",
    emailDesc: "Important business alerts email par receive karein.",
    lowStock: "Low Stock Alerts",
    lowStockDesc: "Stock minimum threshold tak pahunchne par alert milega.",
    outOfStock: "Out of Stock Alerts",
    outOfStockDesc: "Product ka stock completely khatam hone par alert milega.",
    reports: "Report Preferences",
    frequency: "Report Frequency",
    frequencyDesc: "Choose karein ki business reports kitni baar chahiye.",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    save: "Save Changes",
    cancel: "Reset",
    saved: "Notification preferences successfully save ho gayi!",
  },
};

const defaultPreferences = {
  inApp: true,
  email: true,
  lowStock: true,
  outOfStock: true,
  frequency: "Weekly",
};

function getSavedPreferences() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("bizpilot-notification-preferences") || "{}"
    );

    return {
      ...defaultPreferences,
      ...saved,
    };
  } catch (error) {
    console.error("Unable to read notification preferences from local storage.", error);
    return defaultPreferences;
  }
}

function NotificationsReports({ language = "English" }) {
  const t = translations[language] || translations.English;

  const [preferences, setPreferences] = useState(getSavedPreferences);
  const [message, setMessage] = useState("");

  const handleToggle = (field) => {
    setPreferences((previous) => ({
      ...previous,
      [field]: !previous[field],
    }));
    setMessage("");
  };

  const handleSave = () => {
    localStorage.setItem(
      "bizpilot-notification-preferences",
      JSON.stringify(preferences)
    );
    setMessage(t.saved);
  };

  const handleReset = () => {
    setPreferences(defaultPreferences);
    setMessage("");
  };

  const notificationOptions = [
    {
      key: "inApp",
      title: t.inApp,
      description: t.inAppDesc,
    },
    {
      key: "email",
      title: t.email,
      description: t.emailDesc,
    },
    {
      key: "lowStock",
      title: t.lowStock,
      description: t.lowStockDesc,
    },
    {
      key: "outOfStock",
      title: t.outOfStock,
      description: t.outOfStockDesc,
    },
  ];

  return (
    <div className="notifications-page">
      <div className="notifications-heading">
        <div>
          <h2>{t.title}</h2>
          <p>{t.subtitle}</p>
        </div>
      </div>

      <section className="notification-card">
        <div className="notification-section-heading">
          <div className="notification-icon">
            <Bell size={19} />
          </div>
          <div>
            <h3>{t.notificationSettings}</h3>
          </div>
        </div>

        <div className="notification-options">
          {notificationOptions.map((option) => (
            <div className="notification-option" key={option.key}>
              <div className="notification-option-icon">
                {option.key === "email" ? (
                  <Mail size={18} />
                ) : (
                  <Bell size={18} />
                )}
              </div>

              <div className="notification-option-text">
                <h4>{option.title}</h4>
                <p>{option.description}</p>
              </div>

              <button
                type="button"
                className={`notification-toggle ${
                  preferences[option.key] ? "enabled" : ""
                }`}
                onClick={() => handleToggle(option.key)}
                aria-label={`Toggle ${option.title}`}
                aria-pressed={preferences[option.key]}
              >
                <span />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="notification-card">
        <div className="notification-section-heading">
          <div className="notification-icon">
            <FileText size={19} />
          </div>
          <div>
            <h3>{t.reports}</h3>
          </div>
        </div>

        <div className="report-frequency">
          <div>
            <h4>{t.frequency}</h4>
            <p>{t.frequencyDesc}</p>
          </div>

          <select
            value={preferences.frequency}
            onChange={(event) => {
              setPreferences((previous) => ({
                ...previous,
                frequency: event.target.value,
              }));
              setMessage("");
            }}
          >
            <option value="Daily">{t.daily}</option>
            <option value="Weekly">{t.weekly}</option>
            <option value="Monthly">{t.monthly}</option>
          </select>
        </div>
      </section>

      {message && (
        <p className="notification-success">{message}</p>
      )}

      <div className="notification-actions">
        <button
          type="button"
          className="notification-reset-btn"
          onClick={handleReset}
        >
          <RotateCcw size={16} />
          {t.cancel}
        </button>

        <button
          type="button"
          className="notification-save-btn"
          onClick={handleSave}
        >
          <Save size={16} />
          {t.save}
        </button>
      </div>
    </div>
  );
}

export default NotificationsReports;