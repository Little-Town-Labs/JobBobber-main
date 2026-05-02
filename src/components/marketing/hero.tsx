import Link from "next/link"

export function Hero() {
  return (
    <section
      data-testid="hero"
      className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-24 sm:py-32 lg:py-40"
    >
      {/* Background grid decoration */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:4rem_4rem]"
      />

      {/* Glow accent */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl"
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-sm font-medium text-blue-300">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          API-First AI Hiring Platform
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Autonomous AI agents that{" "}
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            match talent
          </span>{" "}
          without the busywork
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300 sm:text-xl">
          No human intervention until the interview. JobBobber&apos;s AI agents match job seekers
          and employers through your existing stack — integrate in minutes via REST API.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/sign-up"
            className="rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
          >
            Get started free
          </Link>
          <Link
            href="/docs"
            className="rounded-lg border border-slate-600 px-8 py-3 text-base font-semibold text-slate-300 transition hover:border-slate-400 hover:text-white"
          >
            View API docs
          </Link>
        </div>
      </div>
    </section>
  )
}
