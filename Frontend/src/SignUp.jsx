import { useState } from "react";
import Field from "./Field.jsx";
import { useAuth } from "./context/contextValues";
import { User, Mail, Lock, Eye, EyeOff, Chat as WhatsApp, Arrow, Box } from "./icons.jsx";

const isValidMobileNumber = (number) => /^[6-9]\d{9}$/.test(number);

// The same choices as the business type list in Settings.
const BUSINESS_TYPES = ["Retail", "Wholesale", "Manufacturing", "Food & Beverage", "Services", "Other"];

// Which step each form field is on, and the names the server uses for them.
const FIELD_STEP = { firstName: 1, lastName: 1, email: 1, whatsapp: 1, password: 1, businessName: 2, businessType: 2, address: 2 };
const SERVER_FIELD = {
  firstName: "firstName",
  lastName: "lastName",
  email: "email",
  whatsappNumber: "whatsapp",
  password: "password",
  "business.name": "businessName",
  "business.type": "businessType",
  "business.address": "address",
};

const selectWrap =
  "flex h-11 items-center gap-2.5 rounded-xl border bg-[var(--auth-input)] px-3.5 text-muted transition " +
  "focus-within:border-brand-500 focus-within:text-brand-700 focus-within:ring-4 focus-within:ring-mint-100";

export default function SignUp({ onSignIn, onAccountCreated }) {
  const { signUp } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", whatsapp: "", password: "",
    businessName: "", businessType: "", address: "",
  });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState("");

  const set = (key) => (e) => {
    const value = key === "whatsapp" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((current) => {
      if (!current[key] && !current.form) return current;
      const next = { ...current };
      delete next[key];
      delete next.form;
      return next;
    });
    if (key === "whatsapp") setVerificationNotice("");
  };

  const validateAccount = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "Enter your first name.";
    if (!form.lastName.trim()) e.lastName = "Enter your last name.";
    if (!form.email.trim()) e.email = "Enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email address.";
    if (!form.whatsapp) e.whatsapp = "Enter your WhatsApp number.";
    else if (!isValidMobileNumber(form.whatsapp)) e.whatsapp = "Enter a valid 10-digit mobile number.";
    if (!form.password) e.password = "Create a password.";
    else if (form.password.length < 8) e.password = "Use at least 8 characters.";
    return e;
  };

  const validateBusiness = () => {
    const e = {};
    if (!form.businessName.trim()) e.businessName = "Enter your shop or business name.";
    if (!form.businessType) e.businessType = "Choose a business type.";
    if (!form.address.trim()) e.address = "Enter your business address.";
    return e;
  };

  const handleNext = (ev) => {
    ev.preventDefault();
    const e = validateAccount();
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(2);
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const e = validateBusiness();
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      await signUp({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        whatsappNumber: `+91${form.whatsapp}`,
        password: form.password,
        business: {
          name: form.businessName.trim(),
          type: form.businessType,
          address: form.address.trim(),
        },
      });
    } catch (error) {
      setLoading(false);
      const next = {};
      if (error.status === 409) {
        next.email = error.message;
      } else if (error.errors?.length) {
        error.errors.forEach(({ field, message }) => {
          const key = SERVER_FIELD[field];
          if (key) next[key] = message;
        });
      }
      if (Object.keys(next).length === 0) next.form = error.message;
      setErrors(next);
      // Show the step that has the problem.
      const fieldKeys = Object.keys(next).filter((key) => key !== "form");
      if (fieldKeys.some((key) => FIELD_STEP[key] === 1)) setStep(1);
      return;
    }
    setLoading(false);
    onAccountCreated?.();
  };

  const buttonClasses =
    "flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-brand-700 text-base font-semibold text-white transition hover:bg-brand-900 active:translate-y-px disabled:cursor-progress disabled:opacity-70";

  return (
    <>
      <h2 className="text-center text-2xl font-bold tracking-tight text-brand-900">Create your account</h2>
      <p className="mb-1 mt-1 text-center text-sm text-muted">
        {step === 1 ? "Start managing your shop with BizPilot" : "Tell us about your shop"}
      </p>
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-brand-700" aria-live="polite">
        Step {step} of 2
      </p>

      {step === 1 ? (
        <form onSubmit={handleNext} noValidate>
          <div className="mb-2 grid gap-2 sm:grid-cols-2">
            <Field
              id="firstName" label="First name" icon={User} autoComplete="given-name"
              placeholder="First name" value={form.firstName} onChange={set("firstName")} error={errors.firstName}
            />
            <Field
              id="lastName" label="Last name" icon={User} autoComplete="family-name"
              placeholder="Last name" value={form.lastName} onChange={set("lastName")} error={errors.lastName}
            />
          </div>

          <Field
            className="mb-2" id="email" label="Email" icon={Mail} type="email" autoComplete="email"
            placeholder="Enter your email address" value={form.email} onChange={set("email")} error={errors.email}
          />

          <Field
            className="mb-2" id="whatsapp" label="WhatsApp number" icon={WhatsApp} prefix="+91"
            type="tel" inputMode="numeric" autoComplete="tel-national" required
            placeholder="Enter your WhatsApp number" value={form.whatsapp} onChange={set("whatsapp")} error={errors.whatsapp}
            trailing={
              <button
                type="button"
                disabled={!form.whatsapp}
                onClick={() => {
                  if (!isValidMobileNumber(form.whatsapp)) {
                    setErrors((current) => ({
                      ...current,
                      whatsapp: "Enter a valid 10-digit mobile number.",
                    }));
                    setVerificationNotice("");
                    return;
                  }
                  setVerificationNotice("Number verification will be available once the verification service is connected.");
                }}
                className="whitespace-nowrap rounded-lg px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-mint-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Verify
              </button>
            }
          />
          {verificationNotice && (
            <p role="status" className="-mt-1 mb-2 text-xs text-muted">
              {verificationNotice}
            </p>
          )}

          <Field
            className="mb-3" id="password" label="Password" icon={Lock}
            type={show ? "text" : "password"} autoComplete="new-password"
            placeholder="Create a password (min. 8 characters)" value={form.password} onChange={set("password")}
            error={errors.password}
            trailing={
              <button
                type="button" onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="grid cursor-pointer place-items-center rounded-lg p-1 text-muted hover:text-brand-700"
              >
                {show ? <EyeOff /> : <Eye />}
              </button>
            }
          />

          <button type="submit" className={buttonClasses}>
            Next <Arrow />
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <Field
            className="mb-2" id="businessName" label="Shop or business name" icon={Box}
            autoComplete="organization" placeholder="e.g. Sharma General Store"
            value={form.businessName} onChange={set("businessName")} error={errors.businessName}
          />

          <div className="mb-2">
            <label htmlFor="businessType" className="mb-1 block text-sm font-semibold text-ink">Business type</label>
            <div className={`${selectWrap} ${errors.businessType ? "border-danger-700" : "border-line"}`}>
              <select
                id="businessType" value={form.businessType} onChange={set("businessType")}
                aria-invalid={!!errors.businessType}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none"
              >
                <option value="">Select business type</option>
                {BUSINESS_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            {errors.businessType && (
              <p role="alert" className="mt-1.5 text-[13px] text-danger-700">{errors.businessType}</p>
            )}
          </div>

          <Field
            className="mb-3" id="address" label="Business address"
            autoComplete="street-address" placeholder="Shop number, street, city"
            value={form.address} onChange={set("address")} error={errors.address}
          />

          {errors.form && (
            <p role="alert" className="mb-3 rounded-xl border border-danger-700 px-3.5 py-2.5 text-sm text-danger-700">
              {errors.form}
            </p>
          )}

          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button
              type="button" disabled={loading} onClick={() => setStep(1)}
              className="h-11 cursor-pointer rounded-xl border border-line px-5 text-base font-semibold text-brand-700 transition hover:bg-mint-50 disabled:opacity-60"
            >
              Back
            </button>
            <button type="submit" disabled={loading} className={buttonClasses}>
              {loading ? "Creating account…" : (<>Create account <Arrow /></>)}
            </button>
          </div>
        </form>
      )}

      <div className="my-3 flex items-center gap-3.5 text-sm text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        or
      </div>

      <p className="text-center text-muted">
        Already have an account?{" "}
        <button type="button" onClick={onSignIn} className="font-semibold text-brand-700 hover:underline">Sign in</button>
      </p>
    </>
  );
}
