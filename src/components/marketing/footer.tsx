import Link from "next/link"

const NAV_LINKS = [
  { href: "/docs", label: "API Docs" },
  { href: "/sign-up", label: "Sign up" },
  { href: "/sign-in", label: "Sign in" },
] as const

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div>
            <Link href="/" className="text-lg font-bold text-slate-900">
              JobBobber
            </Link>
            <p className="mt-1 text-sm text-slate-500">AI-Powered Talent Matching Platform</p>
          </div>

          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap items-center gap-6" role="list">
              {NAV_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-slate-600 transition hover:text-slate-900"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-8 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} JobBobber. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
