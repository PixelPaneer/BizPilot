
import { useState } from "react";
import { Building2, Upload, Save, RotateCcw } from "lucide-react";
import "./BusinessProfile.css";

const defaultProfile = {
  businessName: "",
  businessType: "",
  ownerName: "",
  contact: "",
  email: "",
  address: "",
  description: "",
  logo: ""
};

const translations = {
  English: {
    title: "Business Profile",
    subtitle: "Update your business information and identity.",
    logo: "Business Logo",
    logoHelp: "Upload your business logo (PNG, JPG, maximum 2 MB).",
    upload: "Upload Logo",
    information: "Business Information",
    businessName: "Business Name",
    businessType: "Business Type",
    ownerName: "Owner Name",
    contact: "Contact Number",
    email: "Business Email",
    address: "Business Address",
    description: "Business Description",
    namePlaceholder: "Enter business name",
    typePlaceholder: "Select business type",
    ownerPlaceholder: "Enter owner name",
    contactPlaceholder: "Enter contact number",
    addressPlaceholder: "Enter business address",
    descriptionPlaceholder: "Briefly describe your business...",
    retail: "Retail",
    wholesale: "Wholesale",
    manufacturing: "Manufacturing",
    food: "Food & Beverage",
    services: "Services",
    other: "Other",
    cancel: "Cancel",
    save: "Save Changes",
    nameError: "Business name is required.",
    typeError: "Please select business type.",
    ownerError: "Owner name is required.",
    emailError: "Enter a valid email address.",
    contactError: "Enter a valid contact number.",
    addressError: "Business address is required.",
    imageError: "Please select a valid image file.",
    sizeError: "Logo size must be less than 2 MB.",
    success: "Business profile saved successfully!",
    saveError: "Unable to save. Your logo may be too large."
  },

  Hindi: {
    title: "व्यवसाय प्रोफ़ाइल",
    subtitle: "अपने व्यवसाय की जानकारी और पहचान अपडेट करें।",
    logo: "व्यवसाय का लोगो",
    logoHelp: "अपने व्यवसाय का लोगो अपलोड करें (PNG, JPG, अधिकतम 2 MB)।",
    upload: "लोगो अपलोड करें",
    information: "व्यवसाय की जानकारी",
    businessName: "व्यवसाय का नाम",
    businessType: "व्यवसाय का प्रकार",
    ownerName: "मालिक का नाम",
    contact: "संपर्क नंबर",
    email: "व्यवसाय का ईमेल",
    address: "व्यवसाय का पता",
    description: "व्यवसाय का विवरण",
    namePlaceholder: "व्यवसाय का नाम दर्ज करें",
    typePlaceholder: "व्यवसाय का प्रकार चुनें",
    ownerPlaceholder: "मालिक का नाम दर्ज करें",
    contactPlaceholder: "संपर्क नंबर दर्ज करें",
    addressPlaceholder: "व्यवसाय का पता दर्ज करें",
    descriptionPlaceholder: "अपने व्यवसाय का संक्षिप्त विवरण दें...",
    retail: "खुदरा",
    wholesale: "थोक",
    manufacturing: "विनिर्माण",
    food: "खाद्य और पेय",
    services: "सेवाएँ",
    other: "अन्य",
    cancel: "रद्द करें",
    save: "बदलाव सेव करें",
    nameError: "व्यवसाय का नाम आवश्यक है।",
    typeError: "कृपया व्यवसाय का प्रकार चुनें।",
    ownerError: "मालिक का नाम आवश्यक है।",
    emailError: "सही ईमेल पता दर्ज करें।",
    contactError: "सही संपर्क नंबर दर्ज करें।",
    addressError: "व्यवसाय का पता आवश्यक है।",
    imageError: "कृपया सही इमेज फ़ाइल चुनें।",
    sizeError: "लोगो का आकार 2 MB से कम होना चाहिए।",
    success: "व्यवसाय प्रोफ़ाइल सफलतापूर्वक सेव हो गई!",
    saveError: "सेव नहीं हो पाया। आपका लोगो बहुत बड़ा हो सकता है।"
  },

  Hinglish: {
    title: "Business Profile",
    subtitle: "Apne business ki information aur identity update karein.",
    logo: "Business Logo",
    logoHelp: "Apna business logo upload karein (PNG, JPG, maximum 2 MB).",
    upload: "Logo Upload Karein",
    information: "Business Information",
    businessName: "Business Name",
    businessType: "Business Type",
    ownerName: "Owner Name",
    contact: "Contact Number",
    email: "Business Email",
    address: "Business Address",
    description: "Business Description",
    namePlaceholder: "Business name enter karein",
    typePlaceholder: "Business type select karein",
    ownerPlaceholder: "Owner name enter karein",
    contactPlaceholder: "Contact number enter karein",
    addressPlaceholder: "Business address enter karein",
    descriptionPlaceholder: "Apne business ke baare mein batayein...",
    retail: "Retail",
    wholesale: "Wholesale",
    manufacturing: "Manufacturing",
    food: "Food & Beverage",
    services: "Services",
    other: "Other",
    cancel: "Cancel Karein",
    save: "Changes Save Karein",
    nameError: "Business name zaroori hai.",
    typeError: "Business type select karein.",
    ownerError: "Owner name zaroori hai.",
    emailError: "Valid email address enter karein.",
    contactError: "Valid contact number enter karein.",
    addressError: "Business address zaroori hai.",
    imageError: "Valid image file select karein.",
    sizeError: "Logo ka size 2 MB se kam hona chahiye.",
    success: "Business profile successfully save ho gayi!",
    saveError: "Save nahi ho paya. Logo ka size zyada ho sakta hai."
  }
};

function BusinessProfile({ language = "English" }) {
  const t = translations[language] || translations.English;

  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem("bizpilot-profile");
      return saved
        ? { ...defaultProfile, ...JSON.parse(saved) }
        : defaultProfile;
    } catch {
      return defaultProfile;
    }
  });

  const [savedData, setSavedData] = useState(formData);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: ""
    }));

    setMessage("");
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage(t.imageError);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage(t.sizeError);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setFormData((prev) => ({
        ...prev,
        logo: reader.result
      }));
    };

    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.businessName.trim()) {
      newErrors.businessName = t.nameError;
    }

    if (!formData.businessType) {
      newErrors.businessType = t.typeError;
    }

    if (!formData.ownerName.trim()) {
      newErrors.ownerName = t.ownerError;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t.emailError;
    }

    if (!/^\+?[0-9\s()-]{10,15}$/.test(formData.contact)) {
      newErrors.contact = t.contactError;
    }

    if (!formData.address.trim()) {
      newErrors.address = t.addressError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      localStorage.setItem(
        "bizpilot-profile",
        JSON.stringify(formData)
      );

      setSavedData(formData);
      setMessage(t.success);
    } catch {
      setMessage(t.saveError);
    }
  };

  const handleCancel = () => {
    setFormData(savedData);
    setErrors({});
    setMessage("");
  };

  return (
    <div className="business-profile">

      <div className="section-intro">
        <div className="section-icon">
          <Building2 size={22} />
        </div>

        <div>
          <h3>{t.title}</h3>
          <p>{t.subtitle}</p>
        </div>
      </div>

      <form onSubmit={handleSave}>

        {/* Business Logo */}
        <div className="logo-upload-section">

          <div className="business-logo-preview">
            {formData.logo ? (
              <img src={formData.logo} alt={t.logo} />
            ) : (
              <Building2 size={30} />
            )}
          </div>

          <div className="logo-upload-info">
            <h4>{t.logo}</h4>
            <p>{t.logoHelp}</p>

            <label className="upload-btn">
              <Upload size={15} />
              {t.upload}

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoUpload}
                hidden
              />
            </label>
          </div>

        </div>

        <div className="form-divider"></div>

        {/* Business Details */}
        <h4 className="form-section-title">{t.information}</h4>

        <div className="profile-form-grid">

          <div className="form-group">
            <label>{t.businessName} *</label>
            <input
              name="businessName"
              value={formData.businessName}
              onChange={handleChange}
              placeholder={t.namePlaceholder}
            />
            {errors.businessName && (
              <span className="field-error">{errors.businessName}</span>
            )}
          </div>

          <div className="form-group">
            <label>{t.businessType} *</label>
            <select
              name="businessType"
              value={formData.businessType}
              onChange={handleChange}
            >
              <option value="">{t.typePlaceholder}</option>
              <option value="Retail">{t.retail}</option>
              <option value="Wholesale">{t.wholesale}</option>
              <option value="Manufacturing">{t.manufacturing}</option>
              <option value="Food & Beverage">{t.food}</option>
              <option value="Services">{t.services}</option>
              <option value="Other">{t.other}</option>
            </select>
            {errors.businessType && (
              <span className="field-error">{errors.businessType}</span>
            )}
          </div>

          <div className="form-group">
            <label>{t.ownerName} *</label>
            <input
              name="ownerName"
              value={formData.ownerName}
              onChange={handleChange}
              placeholder={t.ownerPlaceholder}
            />
            {errors.ownerName && (
              <span className="field-error">{errors.ownerName}</span>
            )}
          </div>

          <div className="form-group">
            <label>{t.contact} *</label>
            <input
              name="contact"
              value={formData.contact}
              onChange={handleChange}
              placeholder={t.contactPlaceholder}
            />
            {errors.contact && (
              <span className="field-error">{errors.contact}</span>
            )}
          </div>

          <div className="form-group">
            <label>{t.email} *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="business@example.com"
            />
            {errors.email && (
              <span className="field-error">{errors.email}</span>
            )}
          </div>

          <div className="form-group">
            <label>{t.address} *</label>
            <input
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder={t.addressPlaceholder}
            />
            {errors.address && (
              <span className="field-error">{errors.address}</span>
            )}
          </div>

        </div>

        {/* Description */}
        <div className="form-group description-group">
          <label>{t.description}</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder={t.descriptionPlaceholder}
            rows="4"
          />
        </div>

        {/* Actions */}
        {message && (
          <p className="profile-message" role="status">{message}</p>
        )}

        <div className="profile-actions">

          <button
            type="button"
            className="profile-cancel-btn"
            onClick={handleCancel}
          >
            <RotateCcw size={16} />
            {t.cancel}
          </button>

          <button type="submit" className="profile-save-btn">
            <Save size={16} />
            {t.save}
          </button>

        </div>

      </form>
    </div>
  );
}

export default BusinessProfile;
