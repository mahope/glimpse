import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">Siden blev ikke fundet</h2>
        <p className="text-gray-500">Den side du leder efter eksisterer ikke.</p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Gå til dashboard</Link>
      </Button>
    </div>
  )
}
