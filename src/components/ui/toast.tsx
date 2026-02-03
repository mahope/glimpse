"use client"

import { useEffect, useState } from 'react'

export type Toast = { id: number; kind: 'success'|'error'|'info'; message: string }

let pushToastCb: ((t: Toast) => void) | null = null

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  useEffect(() => { pushToastCb = (t: Toast) => { setToasts(prev => [...prev, t]); setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3000) };
    return () => { pushToastCb = null }
  }, [])
  return { toasts }
}

export function toast(kind: Toast['kind'], message: string) {
  const id = Date.now()
  if (pushToastCb) pushToastCb({ id, kind, message })
}

export function ToastHost() {
  const { toasts } = useToast()
  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {toasts.map(t => (
        <div key={t.id} className={`px-3 py-2 rounded text-sm shadow ${t.kind==='success'?'bg-green-600 text-white':t.kind==='error'?'bg-red-600 text-white':'bg-gray-800 text-white'}`}>{t.message}</div>
      ))}
    </div>
  )
}
