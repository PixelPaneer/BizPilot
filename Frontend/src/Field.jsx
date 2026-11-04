/* Labelled input with a leading icon, optional prefix (e.g. +91) and optional trailing control. */
const wrap =
  "flex h-11 items-center gap-2.5 rounded-xl border bg-white px-3.5 text-muted transition " +
  "focus-within:border-brand-500 focus-within:text-brand-700 focus-within:ring-4 focus-within:ring-mint-100";

export default function Field({ id, label, icon: Icon, prefix, trailing, error, className = "", ...inputProps }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink">{label}</label>
      <div className={`${wrap} ${error ? "border-danger-700" : "border-line"}`}>
        {Icon && <Icon />}
        {prefix && <span className="border-r border-line pr-2.5 text-[15px] font-medium text-ink">{prefix}</span>}
        <input
          id={id} aria-invalid={!!error}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-[#9aa59e]"
          {...inputProps}
        />
        {trailing}
      </div>
      {error && <p role="alert" className="mt-1.5 text-[13px] text-danger-700">{error}</p>}
    </div>
  );
}
