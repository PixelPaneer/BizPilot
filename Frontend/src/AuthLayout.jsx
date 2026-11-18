import Logo from "./Logo.jsx";
import hero from "./assets/hero.jpg";
import { Box, Receipt, Chart, Chat } from "./icons.jsx";

const features = [
  { icon: Box, title: "Manage inventory", text: "Track stock and get low-stock alerts." },
  { icon: Receipt, title: "Create bills", text: "Generate bills and download them as PDF." },
  { icon: Chart, title: "Business insights", text: "Understand your sales and top products." },
  { icon: Chat, title: "Customer enquiries", text: "Answer product and price questions on WhatsApp." },
];

/* Shared shell for the sign-in and sign-up pages: brand panel on the left, form card on the right. */
export default function AuthLayout({ children }) {
  return (
    <main className="grid min-h-full min-[860px]:grid-cols-[1.15fr_1fr]">
      {/* ---------- Left: brand panel ---------- */}
      <section
        className="relative hidden flex-col overflow-hidden px-[clamp(32px,6vw,88px)] py-14 min-[860px]:flex
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
          <figcaption className="mt-1.5 text-[13px] text-muted">Small business owner, Bhopal</figcaption>
        </figure>
      </section>

      {/* ---------- Right: form ---------- */}
      <section className="grid min-h-screen place-items-center bg-gradient-to-b from-cream to-mint-50 px-6 py-10 min-[860px]:bg-none min-[860px]:bg-white">
        <div className="w-full max-w-[480px] rounded-[20px] border border-line bg-white px-[22px] py-8 shadow-[0_12px_40px_rgba(31,74,58,0.08)] sm:px-11 sm:pb-9 sm:pt-11">
          <div className="mb-7 flex justify-center">
            <Logo className="h-16 w-40" />
          </div>

          {children}
        </div>
      </section>
    </main>
  );
}
