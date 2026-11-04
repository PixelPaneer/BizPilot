function BrandLogo() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <img src="/bizpilot-logo.png" alt="BizPilot" className="h-11 w-auto shrink-0" />

      <div className="hidden sm:block" aria-hidden="true">
        <p className="text-[1.45rem] font-extrabold leading-none tracking-tight">
          <span className="text-forest">Biz</span>
          <span className="text-gold">Pilot</span>
        </p>
        <p className="mt-1 text-[0.6rem] font-medium tracking-wide text-muted">
          AI Business Assistant
        </p>
      </div>
    </div>
  )
}

export default BrandLogo