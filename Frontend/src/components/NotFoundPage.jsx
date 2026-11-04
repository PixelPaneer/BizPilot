import { ArrowLeft, House, PackageSearch, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'

function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-cream px-5 py-12 text-ink">
      <div className="w-full max-w-2xl text-center">
        <div className="mb-12 flex justify-center">
          <BrandLogo />
        </div>

        <div className="relative mx-auto mb-8 flex h-48 w-56 items-center justify-center">
          <span className="absolute left-3 top-5 text-7xl font-extrabold tracking-tighter text-sage-light sm:left-0 sm:text-8xl">
            4
          </span>
          <div className="relative z-10 flex h-36 w-36 -rotate-6 items-center justify-center rounded-[2rem] border-2 border-forest/10 bg-white text-forest shadow-[0_18px_45px_rgba(35,76,58,0.12)]">
            <PackageSearch size={72} strokeWidth={1.5} aria-hidden="true" />
            <span className="absolute -right-3 -top-3 flex h-10 w-10 rotate-6 items-center justify-center rounded-full bg-gold-100 text-gold-dark">
              <Sparkles size={20} aria-hidden="true" />
            </span>
          </div>
          <span className="absolute right-3 top-5 text-7xl font-extrabold tracking-tighter text-sage-light sm:right-0 sm:text-8xl">
            4
          </span>
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-sm font-medium text-muted">
            uh-oh!
          </span>
        </div>

        <div className = "flex flex-col items-center justify-center gap-3">
          <p className="mb-3 inline-flex items-center gap-2 rounded bg-sage-light px-10 py-4 text-sm font-semibold text-forest">
          <Sparkles size={15} aria-hidden="true" />
          Page not found
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-forest sm:text-4xl">
          This page took a little detour
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-muted">
          We couldn’t find the page you were looking for. Let’s get you back to your business.
        </p>
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3 font-semibold text-white transition-colors hover:bg-deep"
          >
            <House size={18} aria-hidden="true" />
            Back to dashboard
          </Link>
          <Link
            to="/inventory"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 py-3 font-semibold text-forest transition-colors hover:bg-sage-light"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Go to inventory
          </Link>
        </div>
      </div>
    </main>
  )
}

export default NotFoundPage
