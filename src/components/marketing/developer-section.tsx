import Link from "next/link"

const CURL_SNIPPET = `curl https://api.jobbobber.com/api/v1/matches \\
  -H "Authorization: Bearer jb_live_your_key_here"`

export function DeveloperSection() {
  return (
    <section className="bg-slate-900 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-4 py-1.5 text-sm font-medium text-slate-300">
            <svg
              aria-hidden="true"
              className="h-4 w-4 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
              />
            </svg>
            Built for developers
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            One API call away from your first match
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
            A clean REST API with OpenAPI documentation. Integrate with any language, any framework.
          </p>
        </div>

        <div className="mt-12">
          <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
            {/* Terminal chrome */}
            <div className="flex items-center gap-1.5 border-b border-slate-700/60 bg-slate-800/50 px-4 py-3">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-red-500/80" />
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-green-500/80" />
              <span className="ml-3 text-xs text-slate-500">shell</span>
            </div>

            <pre className="overflow-x-auto p-6">
              <code className="text-sm leading-relaxed">
                <span className="text-slate-500">$ </span>
                {CURL_SNIPPET.split("\n").map((line, i) => (
                  <span key={i}>
                    {i === 0 ? (
                      <>
                        <span className="text-cyan-400">curl</span>
                        <span className="text-white">
                          {" "}
                          https://api.jobbobber.com/api/v1/matches \
                        </span>
                      </>
                    ) : (
                      <>
                        {"\n  "}
                        <span className="text-yellow-400">-H</span>
                        <span className="text-green-300">
                          {" "}
                          &quot;Authorization: Bearer jb_live_your_key_here&quot;
                        </span>
                      </>
                    )}
                  </span>
                ))}
              </code>
            </pre>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/docs"
            className="rounded-lg bg-white px-8 py-3 text-sm font-semibold text-slate-900 shadow transition hover:bg-slate-100"
          >
            Read the docs
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg border border-slate-600 px-8 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-400 hover:text-white"
          >
            Get your API key
          </Link>
        </div>
      </div>
    </section>
  )
}
