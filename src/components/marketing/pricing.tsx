import type { MarketingPlan } from "./pricing-data"

interface PricingCardProps {
  plan: MarketingPlan
}

function PricingCard({ plan }: PricingCardProps) {
  const isFeatured = plan.id === "employer_business" || plan.id === "seeker_pro"

  return (
    <div
      className={[
        "relative flex flex-col rounded-2xl border p-8",
        isFeatured
          ? "border-blue-600 bg-slate-900 text-white shadow-xl shadow-blue-900/20"
          : "border-slate-200 bg-white text-slate-900",
      ].join(" ")}
    >
      {isFeatured && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            Most popular
          </span>
        </div>
      )}

      <div className="mb-6">
        <p
          className={[
            "mb-1 text-xs font-semibold uppercase tracking-widest",
            isFeatured ? "text-blue-400" : "text-blue-600",
          ].join(" ")}
        >
          {plan.userType === "JOB_SEEKER" ? "For job seekers" : "For employers"}
        </p>
        <h3 className="text-2xl font-bold">{plan.name}</h3>

        <div className="mt-4 flex items-end gap-1">
          {plan.isEnterprise ? (
            <span className="text-3xl font-extrabold">Custom</span>
          ) : (
            <>
              <span className="text-4xl font-extrabold">
                {plan.monthlyPrice === 0 ? "Free" : `$${plan.monthlyPrice}`}
              </span>
              {plan.monthlyPrice > 0 && (
                <span
                  className={[
                    "mb-1 text-sm",
                    isFeatured ? "text-slate-400" : "text-slate-500",
                  ].join(" ")}
                >
                  / month
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <ul
        className="mb-8 flex flex-col gap-3"
        role="list"
        aria-label={`${plan.name} plan features`}
      >
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <svg
              aria-hidden="true"
              className={[
                "mt-0.5 h-5 w-5 shrink-0",
                isFeatured ? "text-blue-400" : "text-blue-600",
              ].join(" ")}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                clipRule="evenodd"
              />
            </svg>
            <span
              className={["text-sm", isFeatured ? "text-slate-300" : "text-slate-700"].join(" ")}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">
        <a
          href={plan.isEnterprise ? "mailto:hello@jobbobber.com" : "/sign-up"}
          className={[
            "block rounded-lg px-6 py-3 text-center text-sm font-semibold transition",
            isFeatured
              ? "bg-blue-600 text-white hover:bg-blue-500"
              : "border border-slate-300 text-slate-900 hover:border-slate-400 hover:bg-slate-50",
          ].join(" ")}
        >
          {plan.isEnterprise
            ? "Contact sales"
            : plan.monthlyPrice === 0
              ? "Get started free"
              : "Start free trial"}
        </a>
      </div>
    </div>
  )
}

interface PricingGroupProps {
  label: string
  plans: readonly MarketingPlan[]
}

function PricingGroup({ label, plans }: PricingGroupProps) {
  return (
    <div>
      <h3 className="mb-6 text-center text-xl font-semibold text-slate-700">{label}</h3>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <PricingCard key={plan.id} plan={plan} />
        ))}
      </div>
    </div>
  )
}

interface PricingProps {
  seekerPlans: readonly MarketingPlan[]
  employerPlans: readonly MarketingPlan[]
}

export function Pricing({ seekerPlans, employerPlans }: PricingProps) {
  return (
    <section className="bg-slate-50 px-6 py-24 sm:py-32" id="pricing">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            Start free. Scale when you&apos;re ready. No hidden fees.
          </p>
        </div>

        <div className="mt-16 flex flex-col gap-16">
          <PricingGroup label="Job Seekers" plans={seekerPlans} />
          <PricingGroup label="Employers" plans={employerPlans} />
        </div>
      </div>
    </section>
  )
}
