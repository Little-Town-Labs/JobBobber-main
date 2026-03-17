"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface MetricsTrendChartInnerProps {
  current: {
    avgTimeToFirstMatchMs: number | null
    avgTimeToMutualAcceptMs: number | null
  }
  previous: {
    avgTimeToFirstMatchMs: number | null
    avgTimeToMutualAcceptMs: number | null
  }
}

function msToHours(ms: number | null): number | null {
  if (ms === null) return null
  return Math.round((ms / (60 * 60 * 1000)) * 10) / 10
}

export default function MetricsTrendChartInner({ current, previous }: MetricsTrendChartInnerProps) {
  const data = [
    {
      name: "Time to First Match",
      Current: msToHours(current.avgTimeToFirstMatchMs),
      Previous: msToHours(previous.avgTimeToFirstMatchMs),
    },
    {
      name: "Time to Mutual Accept",
      Current: msToHours(current.avgTimeToMutualAcceptMs),
      Previous: msToHours(previous.avgTimeToMutualAcceptMs),
    },
  ]

  const hasAnyData = data.some((d) => d.Current !== null || d.Previous !== null)

  if (!hasAnyData) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border text-gray-400">
        No trend data available
      </div>
    )
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis
            label={{ value: "Hours", angle: -90, position: "insideLeft", fontSize: 12 }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip formatter={(value) => [`${value} hrs`, ""]} />
          <Legend />
          <Bar dataKey="Current" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Previous" fill="#94a3b8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
