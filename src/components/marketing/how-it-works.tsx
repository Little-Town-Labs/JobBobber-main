const STEPS = [
  {
    number: "01",
    title: "Register & connect your AI key",
    description:
      "Create an account, choose your plan, and plug in your Anthropic or OpenAI key. Your API credentials stay encrypted and never leave your account.",
  },
  {
    number: "02",
    title: "AI agents match candidates",
    description:
      "JobBobber's autonomous agents analyse job postings and seeker profiles around the clock, surfacing high-confidence matches without any human triage.",
  },
  {
    number: "03",
    title: "Accept or decline via API",
    description:
      "Receive match events on your webhook endpoint. Respond programmatically — accept, decline, or request more info — entirely through the REST API.",
  },
]

export function HowItWorks() {
  return (
    <section className="bg-white px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            From signup to first match in under ten minutes.
          </p>
        </div>

        <ol className="mt-16 grid gap-8 sm:grid-cols-3" aria-label="Steps">
          {STEPS.map((step) => (
            <li key={step.number} className="relative flex flex-col gap-4">
              {/* Connector line — visible between items on sm+ */}
              <div
                aria-hidden="true"
                className="absolute left-10 top-5 hidden h-px w-full bg-slate-200 sm:block last:hidden"
              />

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {step.number}
              </div>

              <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="text-slate-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
