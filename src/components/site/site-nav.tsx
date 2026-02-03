'use client'
import Link from 'next/link'

function cls(active: boolean) {
  return `px-3 py-1.5 rounded text-sm ${active ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`
}

export function SiteNav({ siteId, active }: { siteId: string; active: 'overview'|'keywords'|'pages'|'performance'|'issues'|'reports' }) {
  return (
    <nav className="flex items-center gap-2">
      <Link href={`/sites/${siteId}/overview`} className={cls(active==='overview')}>Overview</Link>
      <Link href={`/sites/${siteId}/keywords`} className={cls(active==='keywords')}>Keywords</Link>
      <Link href={`/sites/${siteId}/pages`} className={cls(active==='pages')}>Pages</Link>
      <Link href={`/sites/${siteId}/performance`} className={cls(active==='performance')}>Performance</Link>
      <Link href={`/sites/${siteId}/issues`} className={cls(active==='issues')}>Issues</Link>
      <Link href={`/sites/${siteId}/reports`} className={cls(active==='reports')}>Reports</Link>
    </nav>
  )
}
