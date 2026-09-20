import Link from "next/link";
export function SiteNav() {
  return <nav className="nav" aria-label="Main navigation"><Link className="brand" href="/"><span className="brand-mark">j.</span> Jev Traps <span className="version">OSS / 0.1</span></Link><div className="navlinks"><Link href="/">Registry</Link><Link href="/how-it-works">Why Jev</Link><Link href="/scan">Scan a page</Link><Link href="/developers">For developers</Link><a href="https://github.com/cyberesia/jev-traps">GitHub ↗</a></div><Link className="nav-submit" href="/submit">Report a trap ↗</Link></nav>;
}
