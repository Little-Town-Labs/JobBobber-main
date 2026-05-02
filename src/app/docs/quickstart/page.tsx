import { type Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Quickstart — JobBobber API",
  description: "Get up and running with the JobBobber REST API in minutes.",
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://api.jobbobber.com"

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm leading-relaxed text-gray-100">
      <code>{children}</code>
    </pre>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  )
}

export default function QuickstartPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      {/* Back link */}
      <Link
        href="/docs"
        className="mb-8 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        &larr; Full API Reference
      </Link>

      <h1 className="mb-2 mt-4 text-3xl font-bold text-gray-900">Quickstart</h1>
      <p className="mb-10 text-gray-500">
        Make your first JobBobber API call in under five minutes.
      </p>

      <div className="space-y-12">
        {/* 1. Get your API key */}
        <Section id="get-api-key" title="1. Get your API key">
          <p className="text-gray-700">
            API keys are generated on the{" "}
            <Link href="/welcome" className="text-blue-600 hover:text-blue-800 underline">
              Welcome page
            </Link>
            . Every key starts with{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono text-gray-800">
              jb_live_
            </code>
            . Keep it secret — treat it like a password.
          </p>
        </Section>

        {/* 2. Authentication */}
        <Section id="authentication" title="2. Authentication">
          <p className="text-gray-700">
            Pass your key in the{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono text-gray-800">
              Authorization
            </code>{" "}
            header as a Bearer token on every request.
          </p>
          <CodeBlock>{`curl -H "Authorization: Bearer jb_live_YOUR_KEY" \\
  ${BASE_URL}/api/v1/health`}</CodeBlock>
          <p className="text-sm text-gray-500">
            Requests without a valid key return{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">
              401 Unauthorized
            </code>
            .
          </p>
        </Section>

        {/* 3. First API call */}
        <Section id="first-api-call" title="3. First API call — health check">
          <p className="text-gray-700">
            The health endpoint requires no authentication and confirms the API is reachable.
          </p>
          <CodeBlock>{`curl ${BASE_URL}/api/v1/health
# Response:
# { "status": "ok", "timestamp": "2026-05-01T00:00:00.000Z" }`}</CodeBlock>
        </Section>

        {/* 4. List matches */}
        <Section id="list-matches" title="4. List your matches">
          <p className="text-gray-700">
            Retrieve candidate-to-posting matches associated with your account.
          </p>
          <CodeBlock>{`curl -H "Authorization: Bearer jb_live_YOUR_KEY" \\
  ${BASE_URL}/api/v1/matches`}</CodeBlock>
          <p className="text-sm text-gray-500">
            Supports optional query parameters:{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">page</code>,{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">limit</code>, and{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">status</code>. See
            the full reference for details.
          </p>
        </Section>

        {/* 5. Register a webhook */}
        <Section id="webhooks" title="5. Register a webhook">
          <p className="text-gray-700">
            Subscribe to real-time match events by registering a webhook URL. Supported events are{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono text-gray-800">
              MATCH_CREATED
            </code>{" "}
            and{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono text-gray-800">
              MATCH_ACCEPTED
            </code>
            .
          </p>
          <CodeBlock>{`curl -X POST \\
  -H "Authorization: Bearer jb_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://your-server.com/hook","events":["MATCH_CREATED","MATCH_ACCEPTED"]}' \\
  ${BASE_URL}/api/v1/webhooks`}</CodeBlock>
          <p className="text-sm text-gray-500">
            JobBobber will send a signed{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">POST</code> to your
            URL whenever a matching event occurs.
          </p>
        </Section>

        {/* 6. Full API reference CTA */}
        <Section id="api-reference" title="6. Explore the full API reference">
          <p className="text-gray-700">
            The interactive Scalar UI documents every endpoint, request schema, and response model.
          </p>
          <Link
            href="/docs"
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Open API Reference &rarr;
          </Link>
        </Section>
      </div>
    </main>
  )
}
