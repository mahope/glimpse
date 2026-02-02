import React from 'react'

export function TrendBadge({ value }: { value: number }) {
  const formatted = `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  const color = value > 5 ? 'text-green-700 bg-green-100' : value < -5 ? 'text-red-700 bg-red-100' : 'text-gray-700 bg-gray-100'
  return <span className={`px-2 py-1 rounded text-xs ${color}`}>{formatted}</span>
}
