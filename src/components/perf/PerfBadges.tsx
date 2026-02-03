import { Badge } from '@/components/ui/badge'

export function CwvBadge({ value, type }: { value: number | undefined | null; type: 'lcp' | 'inp' | 'cls' }) {
  const thresholds = {
    lcp: { pass: 2500, meh: 4000 },
    inp: { pass: 200, meh: 500 },
    cls: { pass: 0.1, meh: 0.25 },
  }[type]

  if (value == null) return <Badge variant="outline">N/A</Badge>

  const status = value <= thresholds.pass ? 'pass' : value <= thresholds.meh ? 'needs' : 'fail'
  const variant = status === 'pass' ? 'default' : status === 'needs' ? 'secondary' : 'destructive'

  return <Badge variant={variant}>{status}</Badge>
}
