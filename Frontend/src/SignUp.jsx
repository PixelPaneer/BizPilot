import { useState } from "react";
import AuthLayout from "./AuthLayout.jsx";
import Field from "./Field.jsx";
import { User, Mail, Lock, Eye, EyeOff, Chat as WhatsApp, Arrow } from "./icons.jsx";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
const isValidMobileNumber = (number) => /^[6-9]\d{9}$/.test(number);

async function authRequest(endpoint, body) {
  const response = await fetch(`${API_BASE_URL}/auth${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Something went wrong. Please try again.");
  }
  return result;
}

export default function SignUp({ onSignIn }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", whatsapp: "", password: "" });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState("");
  const [otp, setOtp] = useState("");
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verifiedNumber, setVerifiedNumber] = useState("");

  const fullWhatsappNumber = `+91${form.whatsapp}`;
  const isWhatsappVerified = verifiedNumber === fullWhatsappNumber;

  const set = (key) => (e) => {
    const value = key === "whatsapp" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    if (key === "whatsapp") {
      setVerificationNotice("");
      setOtp("");
      setOtpDialogOpen(false);
      setVerifiedNumber("");
    }
  };

  const handleSendOtp = async () => {
    if (!isValidMobileNumber(form.whatsapp)) {
      setErrors((current) => ({ ...current, whatsapp: "Enter a valid 10-digit mobile number." }));
      setVerificationNotice("");
      return;
    }

    setSendingOtp(true);
    setVerificationNotice("");
    try {
      await authRequest("/whatsapp/send-otp", { whatsappNumber: fullWhatsappNumber });
      setOtp("");
      setOtpDialogOpen(true);
      setVerificationNotice(`OTP sent to WhatsApp number ${fullWhatsappNumber}.`);
    } catch (error) {
      setVerificationNotice(error.message);
      setOtpDialogOpen(false);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setVerificationNotice("Enter the 6-digit OTP received on WhatsApp.");
      return;
    }

    setVerifyingOtp(true);
    setVerificationNotice("");
    try {
      await authRequest("/whatsapp/verify-otp", {
        whatsappNumber: fullWhatsappNumber,
        otp,
      });
      setVerifiedNumber(fullWhatsappNumber);
      setOtpDialogOpen(false);
      setVerificationNotice("WhatsApp number verified successfully.");
      setErrors((current) => {
        const next = { ...current };
        delete next.whatsapp;
        return next;
      });
    } catch (error) {
      setVerificationNotice(error.message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "Enter your first name.";
    if (!form.lastName.trim()) e.lastName = "Enter your last name.";
    if (!form.email.trim()) e.email = "Enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Enter a valid email address.";
    if (!form.whatsapp) e.whatsapp = "Enter your WhatsApp number.";
    else if (!isValidMobileNumber(form.whatsapp)) e.whatsapp = "Enter a valid 10-digit mobile number.";
    else if (!isWhatsappVerified) e.whatsapp = "Verify your WhatsApp number before creating an account.";
    if (!form.password) e.password = "Create a password.";
    else if (form.password.length < 8) e.password = "Use at least 8 characters.";
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    setVerificationNotice("");
    try {
      await authRequest("/register", {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        whatsappNumber: fullWhatsappNumber,
        password: form.password,
      });
      setVerificationNotice("Account created successfully. Please sign in.");
      onSignIn();
    } catch (error) {
      setVerificationNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-center text-2xl font-bold tracking-tight text-brand-900">Create your account</h2>
      <p className="mb-3 mt-1 text-center text-sm text-muted">Start managing your shop with BizPilot</p>

      <form onSubmit={handleSubmit} noValidate>
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
          className="mb-1" id="whatsapp" label="WhatsApp number" icon={WhatsApp} prefix="+91"
          type="tel" inputMode="numeric" autoComplete="tel-national" required
          placeholder="Enter your WhatsApp number" value={form.whatsapp} onChange={set("whatsapp")} error={errors.whatsapp}
          trailing={
            <button
              type="button"
              disabled={!form.whatsapp || sendingOtp || isWhatsappVerified}
              onClick={handleSendOtp}
              className="whitespace-nowrap rounded-lg px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-mint-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isWhatsappVerified ? "Verified ✓" : sendingOtp ? "Sending…" : "Verify"}
            </button>
          }
        />

        {otpDialogOpen && (
          <div
            role="dialog"
            aria-label="WhatsApp OTP verification"
            className="mb-3 rounded-xl border border-line bg-[#fbfcfa] p-3 shadow-sm"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-brand-900">Verify your WhatsApp number</p>
                <p className="mt-0.5 text-xs text-muted">Enter the 6-digit code sent to {fullWhatsappNumber}.</p>
              </div>
              <button
                type="button"
                onClick={() => setOtpDialogOpen(false)}
                aria-label="Close OTP dialog"
                className="rounded-md px-2 text-lg leading-none text-muted hover:bg-mint-50"
              >
                ×
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="Enter OTP"
                aria-label="6-digit WhatsApp OTP"
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-mint-100"
              />
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || otp.length !== 6}
                className="rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verifyingOtp ? "Checking…" : "Confirm"}
              </button>
            </div>
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={sendingOtp}
              className="mt-2 text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50"
            >
              {sendingOtp ? "Sending…" : "Resend OTP"}
            </button>
          </div>
        )}

        {verificationNotice && (
          <p role="status" className="mb-2 text-xs text-muted">
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

        <button
          type="submit" disabled={loading || !isWhatsappVerified}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-brand-700 text-base font-semibold text-white transition hover:bg-brand-900 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Creating account…" : (<>Create account <Arrow /></>)}
        </button>
      </form>

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
