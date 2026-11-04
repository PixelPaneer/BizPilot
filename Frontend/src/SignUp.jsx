import { useState } from "react";
import AuthLayout from "./AuthLayout.jsx";
import Field from "./Field.jsx";
import { User, Mail, Lock, Eye, EyeOff, Chat as WhatsApp, Arrow } from "./icons.jsx";

const isValidMobileNumber = (number) => /^[6-9]\d{9}$/.test(number);

export default function SignUp({ onSignIn }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", whatsapp: "", password: "" });
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState("");

  const set = (key) => (e) => {
    const value = key === "whatsapp" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    if (key === "whatsapp") setVerificationNotice("");
  };

  const validate = () => {
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

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    // TODO: replace with your API call, e.g. await api.post("/auth/register", { ...form, whatsapp: "+91" + form.whatsapp })
    await new Promise((r) => setTimeout(r, 900));
    setLoading(false);
    console.log("Account created:", { ...form, password: undefined });
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

        <button
          type="submit" disabled={loading}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-brand-700 text-base font-semibold text-white transition hover:bg-brand-900 active:translate-y-px disabled:cursor-progress disabled:opacity-70"
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
