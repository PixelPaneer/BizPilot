import logo from "./assets/logo.png";

export default function Logo({ className = "h-16 w-40" }) {
  return <img src={logo} alt="BizPilot – AI Business Assistant" className={`${className}`} />;
}
