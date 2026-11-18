
import { useState } from "react";
import { Package, Bell, Save, RotateCcw } from "lucide-react";
import "./InventoryPreferences.css";

const defaultPreferences = {
  stockAlerts: true,
  lowStockAlerts: true,
  outOfStockAlerts: true
};

const translations = {
  English: {
    title: "Inventory Preferences",
    subtitle: "Manage how you receive inventory stock alerts.",
    stockAlerts: "Stock Alerts",
    stockDescription: "Enable or disable all inventory-related alerts.",
    alertPreferences: "Alert Preferences",
    lowStock: "Low-stock Alerts",
    lowStockDescription: "Receive alerts when products have low stock.",
    outOfStock: "Out-of-stock Alerts",
    outOfStockDescription: "Receive alerts when products become unavailable.",
    enableStock: "Enable stock alerts",
    enableLow: "Enable low-stock alerts",
    enableOut: "Enable out-of-stock alerts",
    cancel: "Cancel",
    save: "Save Changes",
    success: "Inventory preferences saved successfully!",
    error: "Unable to save preferences."
  },

  Hindi: {
    title: "इन्वेंटरी प्राथमिकताएँ",
    subtitle: "इन्वेंटरी स्टॉक अलर्ट प्राप्त करने की सेटिंग बदलें।",
    stockAlerts: "स्टॉक अलर्ट",
    stockDescription: "सभी इन्वेंटरी से जुड़े अलर्ट चालू या बंद करें।",
    alertPreferences: "अलर्ट प्राथमिकताएँ",
    lowStock: "कम स्टॉक अलर्ट",
    lowStockDescription: "प्रोडक्ट का स्टॉक कम होने पर अलर्ट प्राप्त करें।",
    outOfStock: "स्टॉक समाप्त अलर्ट",
    outOfStockDescription: "प्रोडक्ट उपलब्ध न होने पर अलर्ट प्राप्त करें।",
    enableStock: "स्टॉक अलर्ट चालू करें",
    enableLow: "कम स्टॉक अलर्ट चालू करें",
    enableOut: "स्टॉक समाप्त अलर्ट चालू करें",
    cancel: "रद्द करें",
    save: "बदलाव सेव करें",
    success: "इन्वेंटरी प्राथमिकताएँ सफलतापूर्वक सेव हो गईं!",
    error: "प्राथमिकताएँ सेव नहीं हो पाईं।"
  },

  Hinglish: {
    title: "Inventory Preferences",
    subtitle: "Inventory stock alerts kaise receive karne hain, manage karein.",
    stockAlerts: "Stock Alerts",
    stockDescription: "Saare inventory-related alerts enable ya disable karein.",
    alertPreferences: "Alert Preferences",
    lowStock: "Low-stock Alerts",
    lowStockDescription: "Products ka stock kam hone par alerts paayein.",
    outOfStock: "Out-of-stock Alerts",
    outOfStockDescription: "Product unavailable hone par alerts paayein.",
    enableStock: "Stock alerts enable karein",
    enableLow: "Low-stock alerts enable karein",
    enableOut: "Out-of-stock alerts enable karein",
    cancel: "Cancel Karein",
    save: "Changes Save Karein",
    success: "Inventory preferences successfully save ho gayi!",
    error: "Preferences save nahi ho payi."
  }
};

function InventoryPreferences({ language = "English" }) {
  const t = translations[language] || translations.English;

  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem("bizpilot-inventory-preferences");
      return saved
        ? { ...defaultPreferences, ...JSON.parse(saved) }
        : defaultPreferences;
    } catch {
      return defaultPreferences;
    }
  });

  const [savedPreferences, setSavedPreferences] = useState(preferences);
  const [message, setMessage] = useState("");

  const handleToggle = (name) => {
    setPreferences((prev) => ({
      ...prev,
      [name]: !prev[name]
    }));

    setMessage("");
  };

  const handleSave = () => {
    try {
      localStorage.setItem(
        "bizpilot-inventory-preferences",
        JSON.stringify(preferences)
      );

      setSavedPreferences(preferences);
      setMessage(t.success);
    } catch {
      setMessage(t.error);
    }
  };

  const handleCancel = () => {
    setPreferences(savedPreferences);
    setMessage("");
  };

  return (
    <div className="inventory-preferences">

      {/* Section Heading */}
      <div className="section-intro">
        <div className="section-icon">
          <Package size={22} />
        </div>

        <div>
          <h3>{t.title}</h3>
          <p>{t.subtitle}</p>
        </div>
      </div>

      {/* Master Stock Alert */}
      <div className="preference-card">
        <div className="preference-card-heading">
          <div className="preference-icon">
            <Bell size={20} />
          </div>

          <div className="preference-info">
            <h4>{t.stockAlerts}</h4>
            <p>{t.stockDescription}</p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={preferences.stockAlerts}
            aria-label={t.enableStock}
            className={`toggle-switch ${
              preferences.stockAlerts ? "enabled" : ""
            }`}
            onClick={() => handleToggle("stockAlerts")}
          >
            <span></span>
          </button>
        </div>
      </div>

      {/* Individual Alerts */}
      <h4 className="preference-subtitle">{t.alertPreferences}</h4>

      <div className="preference-card">

        <div className="preference-row">
          <div className="preference-info">
            <h4>{t.lowStock}</h4>
            <p>{t.lowStockDescription}</p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={preferences.lowStockAlerts}
            aria-label={t.enableLow}
            disabled={!preferences.stockAlerts}
            className={`toggle-switch ${
              preferences.lowStockAlerts && preferences.stockAlerts
                ? "enabled"
                : ""
            }`}
            onClick={() => handleToggle("lowStockAlerts")}
          >
            <span></span>
          </button>
        </div>

        <div className="preference-divider"></div>

        <div className="preference-row">
          <div className="preference-info">
            <h4>{t.outOfStock}</h4>
            <p>{t.outOfStockDescription}</p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={preferences.outOfStockAlerts}
            aria-label={t.enableOut}
            disabled={!preferences.stockAlerts}
            className={`toggle-switch ${
              preferences.outOfStockAlerts && preferences.stockAlerts
                ? "enabled"
                : ""
            }`}
            onClick={() => handleToggle("outOfStockAlerts")}
          >
            <span></span>
          </button>
        </div>

      </div>

      {/* Save Message */}
      {message && (
        <p className="preference-message" role="status">
          {message}
        </p>
      )}

      {/* Action Buttons */}
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

export default InventoryPreferences;
