"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/settings/profile', label: 'Profil' },
  { href: '/settings/notifications', label: 'Notifikationer' },
  { href: '/settings/team', label: 'Team' },
]

export function SettingsNav() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 border-b">
      {tabs.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            pathname === tab.href
              ? 'text-foreground border-primary'
              : 'text-muted-foreground hover:text-foreground border-transparent hover:border-primary'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
