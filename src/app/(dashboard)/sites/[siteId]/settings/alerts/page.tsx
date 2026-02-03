import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { PerfDevice, AlertMetric } from '@prisma/client'

export default async function SiteAlertSettings({ params }: { params: { siteId: string } }) {
  const site = await prisma.site.findUnique({ where: { id: params.siteId } })
  if (!site) return notFound()

  const rules = await prisma.alertRule.findMany({ where: { siteId: site.id }, orderBy: { createdAt: 'desc' } })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Alert Rules</h1>
      <div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Metric</th>
              <th className="py-2 pr-4">Device</th>
              <th className="py-2 pr-4">Threshold</th>
              <th className="py-2 pr-4">Recipients</th>
            </tr>
          </thead>
          <tbody>
            {rules.map(r => (
              <tr key={r.id} className="border-b">
                <td className="py-2 pr-4">{r.metric}</td>
                <td className="py-2 pr-4">{r.device}</td>
                <td className="py-2 pr-4">{r.threshold}</td>
                <td className="py-2 pr-4">{r.recipients.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
