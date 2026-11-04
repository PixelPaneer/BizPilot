import { useState } from "react";
import Logo from "./Logo.jsx";
import hero from "./assets/hero.jpg";
import SignUp from "./SignUp.jsx";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Arrow,
  Box,
  Receipt,
  Chart,
  Chat,
} from "./icons.jsx";

const features = [
  {
    icon: Box,
    title: "Manage inventory",
    text: "Track stock and get low-stock alerts.",
  },
  {
    icon: Receipt,
    title: "Create bills",
    text: "Generate bills and download them as PDF.",
  },
  {
    icon: Chart,
    title: "Business insights",
    text: "Understand your sales and top products.",
  },
  {
    icon: Chat,
    title: "Customer enquiries",
    text: "Answer product and price questions on WhatsApp.",
  },
];

const inputWrap =
  "flex h-[50px] items-center gap-2.5 rounded-xl border bg-white px-3.5 text-muted transition " +
  "focus-within:border-brand-500 focus-within:text-brand-700 focus-within:ring-4 focus-within:ring-mint-100";

export default function SignIn({ onSignIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [signIn, setSignIn] = useState(true); // true: sign in, false: sign up
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!email.trim()) e.email = "Enter your email address.";
    else if (!/^\S+@\S+\.\S+$/.test(email))
      e.email = "Enter a valid email address.";
    if (!password) e.password = "Enter your password.";
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    // TODO: replace with your API call, e.g. await api.post("/auth/login", { email, password })
    await new Promise((r) => setTimeout(r, 900));
    setLoading(false);
    console.log("Signed in:", { email });
    onSignIn?.();
  };

  return (
    <main className="grid min-h-screen font-[Figtree] min-[860px]:h-screen min-[860px]:overflow-hidden min-[860px]:grid-cols-[1.15fr_1fr]">
      {/* ---------- Left: brand panel ---------- */}
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
          Manage products, inventory and billing, and get insights with the help
          of AI.
        </p>

        <ul className="mb-8 grid max-w-[340px] gap-[22px]">
          {features.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-4">
              <span className="grid size-12 flex-none place-items-center rounded-xl bg-mint-100 text-brand-700">
                <Icon className="size-[22px]" />
              </span>
              <div>
                <strong className="block text-base text-brand-900">
                  {title}
                </strong>
                <span className="mt-0.5 block text-sm text-muted">{text}</span>
              </div>
            </li>
          ))}
        </ul>

        {/* illustration: tucked against the panel's right edge, partly clipped like a blob */}
        <img
          src={hero}
          alt="Shop owner managing stock and sales on a laptop"
          className="absolute bottom-[5%] right-[-8.6vw] hidden aspect-[3/4] w-[clamp(300px,31vw,450px)] rounded-bl-[10%] rounded-tl-[42%] object-cover shadow-[0_24px_70px_rgba(31,74,58,0.18)] min-[1280px]:block"
        />

        <figure className="relative z-10 mt-auto max-w-[480px] rounded-[14px] border border-line bg-white/70 px-[22px] py-[18px]">
          <blockquote className="text-[15px] leading-normal text-brand-900">
            BizPilot helps me manage my shop easily and saves a lot of time.
          </blockquote>
          <figcaption className="mt-1.5 text-[13px] text-muted">
            Small business owner, Bhopal
          </figcaption>
        </figure>
      </section>

      {/* ---------- Right: form ---------- */}
      {signIn ? (<section className="grid min-h-screen place-items-center overflow-y-auto bg-gradient-to-b from-cream to-mint-50 px-6 py-6 min-[860px]:min-h-0 min-[860px]:bg-none min-[860px]:bg-white">
        <div className="w-full max-w-[480px] rounded-[20px] border border-line bg-white px-[22px] py-8 shadow-[0_12px_40px_rgba(31,74,58,0.08)] sm:px-11 sm:pb-9 sm:pt-11">
          <div className="mb-7 flex justify-center">
            <Logo className="h-16 w-40" />
          </div>

          <h2 className="text-center text-[28px] font-bold tracking-tight text-brand-900">
            Welcome back
          </h2>
          <p className="mb-7 mt-1.5 text-center text-muted">
            Sign in to your BizPilot account
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="mb-[18px]">
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold"
              >
                Email
              </label>
              <div
                className={`${inputWrap} ${errors.email ? "border-danger-700" : "border-line"}`}
              >
                <Mail />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!errors.email}
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-[#9aa59e]"
                />
              </div>
              {errors.email && (
                <p role="alert" className="mt-1.5 text-[13px] text-danger-700">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="mb-[18px]">
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold"
              >
                Password
              </label>
              <div
                className={`${inputWrap} ${errors.password ? "border-danger-700" : "border-line"}`}
              >
                <Lock />
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!errors.password}
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-[#9aa59e]"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="grid cursor-pointer place-items-center rounded-lg p-1 text-muted hover:text-brand-700"
                >
                  {show ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {errors.password && (
                <p role="alert" className="mt-1.5 text-[13px] text-danger-700">
                  {errors.password}
                </p>
              )}
            </div>

            <a
              href="#forgot"
              className="-mt-1 mb-[22px] block text-right text-sm font-semibold text-brand-700 hover:underline"
            >
              Forgot password?
            </a>

            <button
              type="submit"
              disabled={loading}
              className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-brand-700 text-base font-semibold text-white transition hover:bg-brand-900 active:translate-y-px disabled:cursor-progress disabled:opacity-70"
            >
              {loading ? (
                "Signing in…"
              ) : (
                <>
                  Sign in <Arrow />
                </>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3.5 text-sm text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
            or
          </div>

          <p className="text-center text-muted">
            Don’t have an account?{" "}
            <button
              type="button"
              onClick={() => setSignIn(false)}
              className="font-semibold text-brand-700 hover:underline"
            >
              Sign up
            </button>
          </p>
        </div>
      </section>) : (
        <section className="grid h-screen place-items-center overflow-hidden bg-gradient-to-b from-cream to-mint-50 px-3 py-3 min-[860px]:min-h-0 min-[860px]:bg-none min-[860px]:bg-white">
          <div className="w-full max-w-[480px] rounded-[20px] border border-line bg-white px-4 py-4 shadow-[0_12px_40px_rgba(31,74,58,0.08)] sm:px-8 sm:py-5">
            <div className="mb-3 flex justify-center">
              <Logo className="h-16 w-40" />
            </div>
            <SignUp onSignIn={() => setSignIn(true)} />
          </div>
        </section>
      )}
    </main>
  );
}
