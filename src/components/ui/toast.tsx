"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { X } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'info'

export type ToastOptions = {
  undo?: () => void
  duration?: number
}

export type Toast = {
  id: string
  kind: ToastKind
  message: string
  options?: ToastOptions
  exiting?: boolean
}

const MAX_VISIBLE = 3
const DEFAULT_DURATION = 4000

type ToastListener = (t: Toast) => void
type DismissListener = (id: string) => void

let addListener: ToastListener | null = null
let dismissListener: DismissListener | null = null

export function toast(kind: ToastKind, message: string, options?: ToastOptions) {
  const id = crypto.randomUUID()
  if (addListener) addListener({ id, kind, message, options })
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    // Start exit animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    // Remove after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 200)
    // Clear auto-dismiss timer
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  useEffect(() => {
    addListener = (t: Toast) => {
      setToasts(prev => {
        const next = [...prev, t]
        // Remove oldest if over max
        if (next.length > MAX_VISIBLE) {
          const oldest = next[0]
          setTimeout(() => dismiss(oldest.id), 0)
        }
        return next
      })
      // Auto-dismiss after duration
      const duration = t.options?.duration ?? DEFAULT_DURATION
      const timer = setTimeout(() => dismiss(t.id), duration)
      timersRef.current.set(t.id, timer)
    }
    dismissListener = dismiss
    return () => {
      addListener = null
      dismissListener = null
      timersRef.current.forEach(t => clearTimeout(t))
      timersRef.current.clear()
    }
  }, [dismiss])

  return { toasts, dismiss }
}

const kindStyles: Record<ToastKind, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-card text-card-foreground border',
}

export function ToastHost() {
  const { toasts, dismiss } = useToast()
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm shadow-lg transition-all duration-200 ${
            kindStyles[t.kind]
          } ${t.exiting ? 'opacity-0 translate-x-4' : 'animate-toast-in'}`}
        >
          <span className="flex-1">{t.message}</span>
          {t.options?.undo && (
            <button
              className="font-medium underline underline-offset-2 hover:opacity-80 shrink-0"
              onClick={() => {
                t.options?.undo?.()
                dismiss(t.id)
              }}
            >
              Fortryd
            </button>
          )}
          <button
            className="p-0.5 rounded hover:opacity-80 shrink-0"
            onClick={() => dismiss(t.id)}
            aria-label="Luk"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
