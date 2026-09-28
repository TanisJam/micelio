import { useCallback, useEffect, useRef, useState } from 'react'

const TOAST_DURATION_MS = 2200

/** Shows a short-lived text message (e.g. "Link copied"), auto-dismissed after `TOAST_DURATION_MS`. */
export function useToast(): { message: string | null; show: (message: string) => void } {
  const [message, setMessage] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((next: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setMessage(next)
    timeoutRef.current = setTimeout(() => setMessage(null), TOAST_DURATION_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return { message, show }
}
