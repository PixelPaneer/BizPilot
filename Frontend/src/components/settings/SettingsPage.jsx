
import { useState } from "react";
import {
  Building2,
  Package,
  Languages,
  Bell,
  ShieldCheck
} from "lucide-react";

import BusinessProfile from "./BusinessProfile";
import InventoryPreferences from "./InventoryPreferences";
import LanguagePreferences from "./LanguagePreferences";
import NotificationsReports from "./NotificationsReports";
import AccountSecurity from "./AccountSecurity";

import "./SettingsPage.css";

function SettingsPage({
  language,
  onLanguageChange,
  t = {}
}) {
  const [activeSection, setActiveSection] = useState("Business Profile");

  const sections = [
    {
      name: "Business Profile",
      label: t.businessProfile || "Business Profile",
      icon: Building2
    },
    {
      name: "Inventory Preferences",
      label: t.inventoryPreferences || "Inventory Preferences",
      icon: Package
    },
    {
      name: "Language & Preferences",
      label: t.languagePreferences || "Language & Preferences",
      icon: Languages
    },
    {
      name: "Notifications & Reports",
      label: t.notifications || "Notifications & Reports",
      icon: Bell
    },
    {
      name: "Account & Security",
      label: t.accountSecurity || "Account & Security",
      icon: ShieldCheck
    }
  ];

  return (
    <div className="settings-page">

      {/* Page Heading */}
      <div className="settings-heading">
        <div>
          <h2>{t.settings || "Settings"}</h2>
          <p>{t.settingsDescription || "Manage your business profile, preferences and account settings."}</p>
        </div>
      </div>

      {/* Settings Layout */}
      <div className="settings-layout">

        {/* Settings Navigation */}
        <div className="settings-navigation">
          <h3>{t.generalSettings || "GENERAL SETTINGS"}</h3>

          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <button
                key={section.name}
                className={`settings-nav-item ${
                  activeSection === section.name ? "selected" : ""
                }`}
                onClick={() => setActiveSection(section.name)}
              >
                <Icon size={18} />
                <span>{section.label}</span>
              </button>
            );
          })}
        </div>

        {/* Settings Content */}
        <div className="settings-content">
          <div className="settings-content-area">

            {activeSection === "Business Profile" ? (
              <BusinessProfile language={language} />

            ) : activeSection === "Inventory Preferences" ? (
              <InventoryPreferences language={language} />

            ) : activeSection === "Language & Preferences" ? (
              <LanguagePreferences
                language={language}
                onLanguageChange={onLanguageChange}
              />

            ) : activeSection === "Notifications & Reports" ? (
              <NotificationsReports language={language} />

            ) : activeSection === "Account & Security" ? (
              <AccountSecurity language={language} />

            ) : null}

          </div>
        </div>

      </div>
    </div>
  );
}

export default SettingsPage;
