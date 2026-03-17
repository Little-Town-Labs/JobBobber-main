"use client"

import { useState } from "react"
import Link from "next/link"
import { useHiringMetricsGet, useHiringMetricsIsEnabled } from "@/lib/trpc/hooks"
import { MetricsSummaryCards } from "@/components/dashboard/metrics-summary-cards"
import { MetricsTrendChart } from "@/components/dashboard/metrics-trend-chart"
import { MetricsPostingTable } from "@/components/dashboard/metrics-posting-table"
import { MetricsCsvExport } from "@/components/dashboard/metrics-csv-export"

type WindowDays = 30 | 60 | 90

const WINDOW_OPTIONS: WindowDays[] = [30, 60, 90]

export default function HiringMetricsPage() {
  const [windowDays, setWindowDays] = useState<WindowDays>(30)
  const { data: isEnabled, isLoading: loadingFlag } = useHiringMetricsIsEnabled()
  const { data, isLoading } = useHiringMetricsGet({ windowDays })

  if (loadingFlag) {
    return <MetricsPageSkeleton />
  }

  if (!isEnabled) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p className="text-gray-500">This feature is not yet available.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  if (isLoading || !data) {
    return <MetricsPageSkeleton />
  }

  const hasPostings = data.postings.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hiring Metrics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track your hiring pipeline performance over time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-md border">
            {WINDOW_OPTIONS.map((days) => (
              <button
                key={days}
                onClick={() => setWindowDays(days)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  windowDays === days ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
                } ${days === 30 ? "rounded-l-md" : ""} ${days === 90 ? "rounded-r-md" : ""}`}
              >
                {days}d
              </button>
            ))}
          </div>
          <MetricsCsvExport windowDays={windowDays} />
        </div>
      </div>

      {!hasPostings ? (
        <div className="rounded-lg border p-8 text-center">
          <p className="text-gray-500">
            Create your first job posting to start tracking hiring metrics.
          </p>
          <Link
            href="/postings/new"
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create a Posting
          </Link>
        </div>
      ) : (
        <>
          <MetricsSummaryCards aggregates={data.aggregates} trends={data.trends} />

          <section className="rounded-lg border p-6">
            <h2 className="mb-4 text-lg font-semibold">Period Comparison</h2>
            <MetricsTrendChart
              current={{
                avgTimeToFirstMatchMs: data.aggregates.avgTimeToFirstMatchMs,
                avgTimeToMutualAcceptMs: data.aggregates.avgTimeToMutualAcceptMs,
              }}
              previous={{
                avgTimeToFirstMatchMs: data.previousPeriod.avgTimeToFirstMatchMs,
                avgTimeToMutualAcceptMs: data.previousPeriod.avgTimeToMutualAcceptMs,
              }}
            />
          </section>

          <section className="rounded-lg border p-6">
            <h2 className="mb-4 text-lg font-semibold">Posting Performance</h2>
            <MetricsPostingTable
              postings={data.postings}
              aggregates={{
                avgTimeToFirstMatchMs: data.aggregates.avgTimeToFirstMatchMs,
                avgTimeToMutualAcceptMs: data.aggregates.avgTimeToMutualAcceptMs,
              }}
            />
          </section>
        </>
      )}
    </div>
  )
}

function MetricsPageSkeleton() {
  return (
    <div className="space-y-6" data-testid="metrics-page-loading">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded bg-gray-200" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded bg-gray-200" />
      <div className="h-48 animate-pulse rounded bg-gray-200" />
    </div>
  )
}
