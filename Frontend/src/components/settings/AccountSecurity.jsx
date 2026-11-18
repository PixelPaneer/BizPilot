import { useState } from "react";
import {
  ShieldCheck,
  Lock,
  UserRound,
  Monitor,
  Eye,
  EyeOff,
  Save
} from "lucide-react";
import "./AccountSecurity.css";

const translations = {
  English: {
    title: "Account & Security",
    subtitle: "Manage your account information and security preferences.",
    account: "Account Information",
    role: "Account Role",
    owner: "Business Owner",
    access: "Access Level",
    admin: "Administrator",
    security: "Security Settings",
    password: "Change Password",
    current: "Current Password",
    newPassword: "New Password",
    confirm: "Confirm New Password",
    twoFactor: "Two-Factor Authentication",
    twoFactorDesc: "Add an extra layer of security to your account.",
    session: "Login Session",
    sessionDesc: "Your current account session information.",
    active: "Active Session",
    device: "Device",
    browser: "Browser",
    status: "Status",
    loggedIn: "Currently Logged In",
    save: "Update Password",
    saved: "Password updated successfully!",
    mismatch: "New passwords do not match.",
    required: "Please fill in all password fields.",
    short: "Password must be at least 8 characters.",
    reset: "Clear Fields"
  },
  Hindi: {
    title: "अकाउंट और सुरक्षा",
    subtitle: "अपने अकाउंट की जानकारी और सुरक्षा सेटिंग मैनेज करें।",
    account: "अकाउंट जानकारी",
    role: "अकाउंट भूमिका",
    owner: "बिजनेस मालिक",
    access: "एक्सेस लेवल",
    admin: "एडमिनिस्ट्रेटर",
    security: "सुरक्षा सेटिंग",
    password: "पासवर्ड बदलें",
    current: "वर्तमान पासवर्ड",
    newPassword: "नया पासवर्ड",
    confirm: "नया पासवर्ड कन्फर्म करें",
    twoFactor: "टू-फैक्टर ऑथेंटिकेशन",
    twoFactorDesc: "अपने अकाउंट में अतिरिक्त सुरक्षा जोड़ें।",
    session: "लॉगिन सेशन",
    sessionDesc: "आपके वर्तमान अकाउंट सेशन की जानकारी।",
    active: "एक्टिव सेशन",
    device: "डिवाइस",
    browser: "ब्राउज़र",
    status: "स्टेटस",
    loggedIn: "अभी लॉगिन है",
    save: "पासवर्ड अपडेट करें",
    saved: "पासवर्ड सफलतापूर्वक अपडेट हुआ!",
    mismatch: "नए पासवर्ड मैच नहीं कर रहे हैं।",
    required: "कृपया सभी पासवर्ड फील्ड भरें।",
    short: "पासवर्ड कम से कम 8 अक्षरों का होना चाहिए।",
    reset: "फील्ड साफ करें"
  },
  Hinglish: {
    title: "Account & Security",
    subtitle: "Apni account information aur security preferences manage karein.",
    account: "Account Information",
    role: "Account Role",
    owner: "Business Owner",
    access: "Access Level",
    admin: "Administrator",
    security: "Security Settings",
    password: "Change Password",
    current: "Current Password",
    newPassword: "New Password",
    confirm: "Confirm New Password",
    twoFactor: "Two-Factor Authentication",
    twoFactorDesc: "Account mein extra security layer add karein.",
    session: "Login Session",
    sessionDesc: "Aapke current account session ki information.",
    active: "Active Session",
    device: "Device",
    browser: "Browser",
    status: "Status",
    loggedIn: "Currently Logged In",
    save: "Update Password",
    saved: "Password successfully update ho gaya!",
    mismatch: "New passwords match nahi kar rahe.",
    required: "Please saare password fields fill karein.",
    short: "Password minimum 8 characters ka hona chahiye.",
    reset: "Clear Fields"
  }
};

function AccountSecurity({ language = "English" }) {
  const t = translations[language] || translations.English;

  const [passwords, setPasswords] = useState({
    current: "",
    newPassword: "",
    confirm: ""
  });

  const [showPasswords, setShowPasswords] = useState(false);
  const [twoFactor, setTwoFactor] = useState(() => {
    return localStorage.getItem("bizpilot-two-factor") === "true";
  });
  const [message, setMessage] = useState("");

  const updatePasswordField = (field, value) => {
    setPasswords((previous) => ({
      ...previous,
      [field]: value
    }));
    setMessage("");
  };

  const handlePasswordUpdate = (event) => {
    event.preventDefault();

    if (
      !passwords.current ||
      !passwords.newPassword ||
      !passwords.confirm
    ) {
      setMessage(t.required);
      return;
    }

    if (passwords.newPassword.length < 8) {
      setMessage(t.short);
      return;
    }

    if (passwords.newPassword !== passwords.confirm) {
      setMessage(t.mismatch);
      return;
    }

    setMessage(
      "Frontend demo only: connect a secure backend to update passwords."
    );

    setPasswords({
      current: "",
      newPassword: "",
      confirm: ""
    });
  };

  const handleTwoFactor = () => {
    const updatedValue = !twoFactor;
    setTwoFactor(updatedValue);
    localStorage.setItem("bizpilot-two-factor", String(updatedValue));
  };

  const clearFields = () => {
    setPasswords({
      current: "",
      newPassword: "",
      confirm: ""
    });
    setMessage("");
  };

  return (
    <div className="account-security-page">
      <div className="account-security-heading">
        <h2>{t.title}</h2>
        <p>{t.subtitle}</p>
      </div>

      <section className="security-card">
        <div className="security-card-heading">
          <UserRound size={19} />
          <h3>{t.account}</h3>
        </div>

        <div className="account-info-grid">
          <div className="account-info-item">
            <span>{t.role}</span>
            <strong>{t.owner}</strong>
          </div>

          <div className="account-info-item">
            <span>{t.access}</span>
            <strong>{t.admin}</strong>
          </div>
        </div>
      </section>

      <section className="security-card">
        <div className="security-card-heading">
          <Lock size={19} />
          <h3>{t.security}</h3>
        </div>

        <form onSubmit={handlePasswordUpdate}>
          <div className="password-heading">
            <h4>{t.password}</h4>

            <button
              type="button"
              className="show-password-btn"
              onClick={() => setShowPasswords(!showPasswords)}
            >
              {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
              {showPasswords ? "Hide" : "Show"}
            </button>
          </div>

          <div className="password-fields">
            <input
              type={showPasswords ? "text" : "password"}
              placeholder={t.current}
              value={passwords.current}
              onChange={(e) =>
                updatePasswordField("current", e.target.value)
              }
            />

            <input
              type={showPasswords ? "text" : "password"}
              placeholder={t.newPassword}
              value={passwords.newPassword}
              onChange={(e) =>
                updatePasswordField("newPassword", e.target.value)
              }
            />

            <input
              type={showPasswords ? "text" : "password"}
              placeholder={t.confirm}
              value={passwords.confirm}
              onChange={(e) =>
                updatePasswordField("confirm", e.target.value)
              }
            />
          </div>

          {message && (
            <p className="security-message">{message}</p>
          )}

          <div className="security-actions">
            <button
              type="button"
              className="security-reset-btn"
              onClick={clearFields}
            >
              {t.reset}
            </button>

            <button type="submit" className="security-save-btn">
              <Save size={16} />
              {t.save}
            </button>
          </div>
        </form>

        <div className="two-factor-row">
          <div className="two-factor-icon">
            <ShieldCheck size={19} />
          </div>

          <div className="two-factor-text">
            <h4>{t.twoFactor}</h4>
            <p>{t.twoFactorDesc}</p>
          </div>

          <button
            type="button"
            className={`security-toggle ${twoFactor ? "enabled" : ""}`}
            onClick={handleTwoFactor}
            aria-label={t.twoFactor}
            aria-pressed={twoFactor}
          >
            <span />
          </button>
        </div>
      </section>

      <section className="security-card">
        <div className="security-card-heading">
          <Monitor size={19} />
          <h3>{t.session}</h3>
        </div>

        <p className="session-description">{t.sessionDesc}</p>

        <div className="session-info">
          <div>
            <span>{t.active}</span>
            <strong>{t.loggedIn}</strong>
          </div>

          <div>
            <span>{t.device}</span>
            <strong>Desktop / Computer</strong>
          </div>

          <div>
            <span>{t.browser}</span>
            <strong>Web Browser</strong>
          </div>

          <div>
            <span>{t.status}</span>
            <strong className="session-status">Active</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AccountSecurity;