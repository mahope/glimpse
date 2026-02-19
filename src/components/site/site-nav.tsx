'use client'
import Link from 'next/link'

function cls(active: boolean) {
  return `px-3 py-1.5 rounded text-sm ${active ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:text-foreground hover:bg-accent'}`
}

type ActiveTab = 'overview' | 'keywords' | 'pages' | 'performance' | 'issues' | 'reports' | 'alerts' | 'settings'

export function SiteNav({ siteId, active }: { siteId: string; active: ActiveTab }) {
  return (
    <nav className="flex items-center gap-2 flex-wrap">
      <Link href={`/sites/${siteId}/overview`} className={cls(active==='overview')}>Overview</Link>
      <Link href={`/sites/${siteId}/keywords`} className={cls(active==='keywords')}>Keywords</Link>
      <Link href={`/sites/${siteId}/pages`} className={cls(active==='pages')}>Pages</Link>
      <Link href={`/sites/${siteId}/performance`} className={cls(active==='performance')}>Performance</Link>
      <Link href={`/sites/${siteId}/issues`} className={cls(active==='issues')}>Issues</Link>
      <Link href={`/sites/${siteId}/reports`} className={cls(active==='reports')}>Reports</Link>
      <Link href={`/sites/${siteId}/alerts`} className={cls(active==='alerts')}>Alerts</Link>
      <Link href={`/sites/${siteId}/settings/alerts`} className={cls(active==='settings')}>Settings</Link>
    </nav>
  )
}
