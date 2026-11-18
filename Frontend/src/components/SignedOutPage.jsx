function SignedOutPage({ onSignIn }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
        <img src="/bizpilot-logo.png" alt="BizPilot logo" className="mx-auto h-16 w-auto" />
        <p className="mt-4 text-3xl font-extrabold tracking-tight">
          <span className="text-forest">Biz</span>
          <span className="text-gold">Pilot</span>
        </p>
        <p className="mt-1 text-xs text-muted">AI Business Assistant</p>

        <h1 className="mt-6 text-xl font-semibold text-ink">You have been signed out</h1>
        <p className="mt-2 text-sm text-muted">
          Your inventory data is still saved on this device.
        </p>

        <button
          type="button"
          onClick={onSignIn}
          className="mt-6 w-full rounded-full bg-forest px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-deep"
        >
          Sign in again
        </button>
      </div>
    </div>
  )
}

export default SignedOutPage