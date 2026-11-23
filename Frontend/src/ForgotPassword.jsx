import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "./Logo.jsx";
import Field from "./Field.jsx";
import hero from "./assets/hero.jpg";
import {
  normalizeWhatsAppNumber,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
} from "./utils/authApi.js";
import { Mail, Lock, Eye, EyeOff, Arrow, Box, Chart, Chat, Check } from "./icons.jsx";

const RESEND_SECONDS = 60;

const features = [
  { icon: Box, title: "Manage inventory", text: "Track stock and get low-stock alerts." },
  { icon: Chart, title: "Business insights", text: "Understand your sales and top products." },
  { icon: Chat, title: "Customer enquiries", text: "Answer product and price questions on WhatsApp." },
];

const primaryBtn =
  "flex h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-brand-700 text-base font-semibold text-white transition hover:bg-brand-900 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70";
const secondaryBtn =
  "flex h-[52px] w-full cursor-pointer items-center justify-center rounded-xl border border-line bg-[var(--card)] text-base font-semibold text-ink transition hover:bg-mint-50 disabled:cursor-not-allowed disabled:opacity-70";

// Letters and numbers only, at least 8 characters, with both a letter and a number.
const isValidPassword = (value) => /^[A-Za-z0-9]{8,}$/.test(value) && /[A-Za-z]/.test(value) && /\d/.test(value);

const maskEmail = (email) => {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}${"*".repeat(Math.max(name.length - 2, 1))}@${domain}`;
};

// Forgot password flow: 1) choose email / WhatsApp and enter it, 2) enter the 6-digit OTP, 3) set a new password.
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [channel, setChannel] = useState("email"); // "email" | "whatsapp"
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState(""); // 10 digits, +91 is added on send
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [done, setDone] = useState(false);

  // The target the OTP is sent to, in the shape the API expects. Null while the input is invalid.
  const buildTarget = () => {
    if (channel === "email") {
      const value = email.trim().toLowerCase();
      return /^\S+@\S+\.\S+$/.test(value) ? { channel, email: value } : null;
    }
    const number = normalizeWhatsAppNumber(whatsapp);
    return number ? { channel, whatsappNumber: number } : null;
  };
  const target = buildTarget();
  const destination = channel === "email" ? maskEmail(email.trim()) : `+91 ${whatsapp}`;

  // 60-second resend countdown.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  // After a successful reset, go back to the sign-in page.
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => navigate("/signIn", { replace: true }), 2000);
    return () => clearTimeout(id);
  }, [done, navigate]);

  const clearError = (key) =>
    setErrors((current) => {
      if (!current[key] && !current.form) return current;
      const next = { ...current };
      delete next[key];
      delete next.form;
      return next;
    });

  const chooseChannel = (value) => {
    setChannel(value);
    setErrors({});
  };

  const sendOtp = async () => {
    await sendPasswordResetOtp(target);
    setOtp("");
    setSecondsLeft(RESEND_SECONDS);
  };

  // Step 1 -> 2
  const handleSend = async (ev) => {
    ev.preventDefault();
    if (!target) {
      setErrors({
        identifier: channel === "email" ? "Enter a valid email address." : "Enter a valid 10-digit WhatsApp number.",
      });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await sendOtp();
      setStep(2);
    } catch (error) {
      setErrors({ form: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || loading) return;
    setErrors({});
    setLoading(true);
    try {
      await sendOtp();
    } catch (error) {
      setErrors({ form: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Step 2 -> 3
  const handleVerify = async (ev) => {
    ev.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setErrors({ otp: "Enter the 6-digit OTP." });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const result = await verifyPasswordResetOtp(target, otp);
      setResetToken(result?.resetToken ?? "");
      setStep(3);
    } catch (error) {
      setErrors({ otp: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Step 3: save the new password
  const handleReset = async (ev) => {
    ev.preventDefault();
    const e = {};
    if (!isValidPassword(password))
      e.password = "Password must contain at least 8 characters, contain both letters and numbers, with no special or non-ASCII characters.";
    if (repeat !== password) e.repeat = "Passwords do not match.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      await resetPassword(target, otp, password, resetToken);
      setDone(true);
    } catch (error) {
      setErrors({ form: error.message });
    } finally {
      setLoading(false);
    }
  };

  const formError = errors.form && (
    <p role="alert" className="mb-4 rounded-xl border border-danger-700 px-3.5 py-2.5 text-sm text-danger-700">
      {errors.form}
    </p>
  );

  const eyeToggle = (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      aria-label={show ? "Hide password" : "Show password"}
      className="grid cursor-pointer place-items-center rounded-lg p-1 text-muted hover:text-brand-700"
    >
      {show ? <EyeOff /> : <Eye />}
    </button>
  );

  return (
    <main className="grid min-h-screen font-[Figtree] min-[860px]:h-screen min-[860px]:overflow-hidden min-[860px]:grid-cols-[1.15fr_1fr]">
      {/* ---------- Left: brand panel (same as sign in) ---------- */}
      <section
        className="relative hidden h-full min-h-0 flex-col overflow-hidden min-[860px]:flex
  px-[clamp(32px,6vw,88px)] py-8
  bg-[radial-gradient(520px_420px_at_92%_78%,var(--color-mint-100),transparent_70%),linear-gradient(180deg,var(--color-cream),var(--color-mint-50))]"
      >
        <Logo className="h-16 w-40" />
        <h1 className="mb-3 mt-14 max-w-[12ch] text-[clamp(34px,4vw,48px)] font-bold leading-[1.08] tracking-tight text-brand-900">
          Run your business smarter, every day
        </h1>
        <p className="mb-9 max-w-[42ch] text-[17px] leading-normal text-muted">
          Manage products, inventory and billing, and get insights with the help of AI.
        </p>
        <ul className="mb-8 grid max-w-[340px] gap-[22px]">
          {features.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-4">
              <span className="grid size-12 flex-none place-items-center rounded-xl bg-mint-100 text-brand-700">
                <Icon className="size-[22px]" />
              </span>
              <div>
                <strong className="block text-base text-brand-900">{title}</strong>
                <span className="mt-0.5 block text-sm text-muted">{text}</span>
              </div>
            </li>
          ))}
        </ul>
        <img
          src={hero}
          alt="Shop owner managing stock and sales on a laptop"
          className="absolute bottom-[5%] right-[-8.6vw] hidden aspect-[3/4] w-[clamp(300px,31vw,450px)] rounded-bl-[10%] rounded-tl-[42%] object-cover shadow-[0_24px_70px_rgba(31,74,58,0.18)] min-[1280px]:block"
        />
        <figure className="relative z-10 mt-6 max-w-[400px] rounded-[14px] border border-line bg-white/70 px-[22px] py-[18px]">
          <blockquote className="text-[15px] leading-normal text-brand-900">
            BizPilot helps me manage my shop easily and saves a lot of time.
          </blockquote>
        </figure>
      </section>

      {/* ---------- Right: reset flow ---------- */}
      <section className="grid min-h-screen place-items-center overflow-y-auto bg-gradient-to-b from-cream to-mint-50 px-6 py-6 min-[860px]:min-h-0 min-[860px]:bg-none min-[860px]:bg-[var(--auth-page)]">
        <div className="w-full max-w-[480px] rounded-[20px] border border-line bg-[var(--card)] px-[22px] py-8 shadow-[0_12px_40px_rgba(31,74,58,0.08)] sm:px-11 sm:pb-9 sm:pt-11">
          <div className="mb-7 flex justify-center">
            <Logo className="h-16 w-40" />
          </div>

          {done ? (
            <div className="text-center" role="status">
              <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-mint-100 text-brand-700">
                <Check className="size-7" />
              </span>
              <h2 className="text-[26px] font-bold tracking-tight text-brand-900">Password updated</h2>
              <p className="mb-6 mt-1.5 text-muted">Your password has been reset. Redirecting you to sign in…</p>
              <Link to="/signIn" replace className={primaryBtn}>
                Go to sign in
              </Link>
            </div>
          ) : step === 1 ? (
            <form onSubmit={handleSend} noValidate>
              <h2 className="text-center text-[28px] font-bold tracking-tight text-brand-900">Forgot password?</h2>
              <p className="mb-6 mt-1.5 text-center text-muted">
                Choose where you want to receive your 6-digit OTP.
              </p>

              <div className="mb-[18px] grid grid-cols-2 gap-1 rounded-xl border border-line bg-[var(--auth-input)] p-1" role="group" aria-label="Receive OTP on">
                {[
                  ["email", "Email", Mail],
                  ["whatsapp", "WhatsApp", Chat],
                ].map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => chooseChannel(value)}
                    aria-pressed={channel === value}
                    className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${
                      channel === value ? "bg-brand-700 text-white" : "text-muted hover:text-brand-700"
                    }`}
                  >
                    <Icon className="size-[18px]" /> {label}
                  </button>
                ))}
              </div>

              {channel === "email" ? (
                <Field
                  id="fp-email"
                  label="Email address"
                  icon={Mail}
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError("identifier");
                  }}
                  error={errors.identifier}
                  className="mb-[22px]"
                />
              ) : (
                <Field
                  id="fp-whatsapp"
                  label="WhatsApp number"
                  icon={Chat}
                  prefix="+91"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="10-digit mobile number"
                  value={whatsapp}
                  onChange={(e) => {
                    setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 10));
                    clearError("identifier");
                  }}
                  error={errors.identifier}
                  className="mb-[22px]"
                />
              )}

              {formError}

              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? "Sending OTP…" : <>Send OTP <Arrow /></>}
              </button>
              <Link to="/signIn" className="mt-5 block text-center text-sm font-semibold text-brand-700 hover:underline">
                Back to sign in
              </Link>
            </form>
          ) : step === 2 ? (
            <form onSubmit={handleVerify} noValidate>
              <h2 className="text-center text-[28px] font-bold tracking-tight text-brand-900">Verify OTP</h2>
              <p className="mb-6 mt-1.5 text-center text-muted">
                We sent a 6-digit OTP to {channel === "email" ? "your email" : "your WhatsApp number"}{" "}
                <span className="font-semibold text-ink">{destination}</span>.
              </p>

              <div className="mb-[22px]">
                <label htmlFor="fp-otp" className="mb-2 block text-sm font-semibold text-ink">Verification code</label>
                <div
                  className={`flex h-[50px] items-center gap-2.5 rounded-xl border bg-[var(--auth-input)] px-3.5 transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-mint-100 ${errors.otp ? "border-danger-700" : "border-line"}`}
                >
                  <input
                    id="fp-otp"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                      clearError("otp");
                    }}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="Enter the verification code"
                    aria-invalid={!!errors.otp}
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent text-[15px] tracking-widest text-ink outline-none placeholder:tracking-normal placeholder:text-[#9aa59e]"
                  />
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={secondsLeft > 0 || loading}
                    className="flex-none text-sm font-semibold text-brand-700 hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                  >
                    {secondsLeft > 0 ? `Resend (${secondsLeft}s)` : "Resend OTP"}
                  </button>
                </div>
                {errors.otp && <p role="alert" className="mt-1.5 text-[13px] text-danger-700">{errors.otp}</p>}
              </div>

              {formError}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setOtp("");
                    setErrors({});
                  }}
                  className={secondaryBtn}
                >
                  Back
                </button>
                <button type="submit" disabled={loading || otp.length !== 6} className={primaryBtn}>
                  {loading ? "Checking…" : "Verify"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleReset} noValidate>
              <h2 className="text-center text-[28px] font-bold tracking-tight text-brand-900">Reset password</h2>
              <p className="mb-6 mt-1.5 text-center text-muted">Enter a new password for your account.</p>

              <Field
                id="fp-password"
                label="New password"
                icon={Lock}
                type={show ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError("password");
                }}
                trailing={eyeToggle}
                error={errors.password}
                className="mb-[18px]"
              />
              <Field
                id="fp-repeat"
                label="New password (Repeat)"
                icon={Lock}
                type={show ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Repeat new password"
                value={repeat}
                onChange={(e) => {
                  setRepeat(e.target.value);
                  clearError("repeat");
                }}
                error={errors.repeat}
                className="mb-2"
              />
              <p className="mb-[22px] text-[13px] leading-snug text-muted">
                Password must contain at least 8 characters, contain both letters and numbers, with no special or non-ASCII characters.
              </p>

              {formError}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setOtp("");
                    setPassword("");
                    setRepeat("");
                    setErrors({});
                  }}
                  className={secondaryBtn}
                >
                  Back
                </button>
                <button type="submit" disabled={loading} className={primaryBtn}>
                  {loading ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
