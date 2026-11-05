import logo from '../assets/logo.png'

function BrandLogo() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <img src={logo} alt="BizPilot" className="brand-logo-image h-11 w-auto shrink-0 sm:h-[72px]" />
    </div>
  )
}

export default BrandLogo