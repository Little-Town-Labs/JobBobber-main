"use client"

import { useHiringMetricsExportCsv } from "@/lib/trpc/hooks"

interface MetricsCsvExportProps {
  windowDays: 30 | 60 | 90
}

export function MetricsCsvExport({ windowDays }: MetricsCsvExportProps) {
  const exportCsv = useHiringMetricsExportCsv({
    onSuccess: () => {
      // Download handled in mutateAsync callback below
    },
  })

  async function handleExport() {
    const result = await exportCsv.mutateAsync({ windowDays })
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = result.filename
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      disabled={exportCsv.isPending}
      className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
    >
      {exportCsv.isPending ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <span>↓</span>
      )}
      Export CSV
    </button>
  )
}
