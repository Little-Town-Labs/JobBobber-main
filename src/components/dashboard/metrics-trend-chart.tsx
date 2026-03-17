"use client"

import dynamic from "next/dynamic"

const Chart = dynamic(() => import("./metrics-trend-chart-inner"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded bg-gray-200" />,
})

interface MetricsTrendChartProps {
  current: {
    avgTimeToFirstMatchMs: number | null
    avgTimeToMutualAcceptMs: number | null
  }
  previous: {
    avgTimeToFirstMatchMs: number | null
    avgTimeToMutualAcceptMs: number | null
  }
}

export function MetricsTrendChart(props: MetricsTrendChartProps) {
  return <Chart {...props} />
}
