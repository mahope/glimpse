'use client'

import * as React from 'react'
import { format, subDays, differenceInDays, startOfDay } from 'date-fns'
import { da } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { DateRange } from 'react-day-picker'

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

export type DateRangeValue =
  | { mode: 'preset'; days: number }
  | { mode: 'custom'; from: string; to: string }

export interface DateRangePickerProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  presets?: { label: string; days: number }[]
  maxDays?: number
  className?: string
}

const DEFAULT_PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

export function DateRangePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  maxDays = 365,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  const isPreset = value.mode === 'preset'
  const activeDays = isPreset ? value.days : null

  // Convert value to display dates
  const displayRange = React.useMemo(() => {
    if (value.mode === 'preset') {
      const to = startOfDay(new Date())
      const from = subDays(to, value.days)
      return { from, to }
    }
    return {
      from: new Date(value.from + 'T00:00:00'),
      to: new Date(value.to + 'T00:00:00'),
    }
  }, [value])

  const handlePreset = (days: number) => {
    onChange({ mode: 'preset', days })
  }

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (!range?.from) return

    if (range.to) {
      const from = startOfDay(range.from)
      const to = startOfDay(range.to)
      const diff = differenceInDays(to, from)
      if (diff > maxDays) return
      onChange({
        mode: 'custom',
        from: format(from, 'yyyy-MM-dd'),
        to: format(to, 'yyyy-MM-dd'),
      })
      setOpen(false)
    }
  }

  const today = startOfDay(new Date())

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Quick preset buttons */}
      <div className="flex rounded-md border overflow-hidden">
        {presets.map(p => (
          <button
            key={p.days}
            type="button"
            onClick={() => handlePreset(p.days)}
            className={cn(
              'px-3 py-1.5 text-sm transition-colors',
              isPreset && activeDays === p.days
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range picker */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors',
              !isPreset
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {!isPreset ? (
              <span>
                {format(displayRange.from, 'd MMM', { locale: da })} – {format(displayRange.to, 'd MMM', { locale: da })}
              </span>
            ) : (
              <span>Vælg</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            defaultMonth={displayRange.from}
            selected={{ from: displayRange.from, to: displayRange.to }}
            onSelect={handleRangeSelect}
            numberOfMonths={2}
            disabled={{ after: today }}
            locale={da}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

/** Helper: convert DateRangeValue to query params for API calls */
export function dateRangeToParams(value: DateRangeValue): Record<string, string> {
  if (value.mode === 'preset') {
    return { days: String(value.days) }
  }
  return { from: value.from, to: value.to }
}

/** Helper: read DateRangeValue from URL search params */
export function dateRangeFromSearchParams(sp: URLSearchParams, defaultDays = 30): DateRangeValue {
  const from = sp.get('from')
  const to = sp.get('to')
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { mode: 'custom', from, to }
  }
  const days = Number(sp.get('days')) || defaultDays
  return { mode: 'preset', days }
}

/** Helper: write DateRangeValue to URL search params */
export function dateRangeToSearchParams(sp: URLSearchParams, value: DateRangeValue) {
  if (value.mode === 'preset') {
    sp.set('days', String(value.days))
    sp.delete('from')
    sp.delete('to')
  } else {
    sp.set('from', value.from)
    sp.set('to', value.to)
    sp.delete('days')
  }
}
