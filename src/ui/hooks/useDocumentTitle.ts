import { useEffect } from 'react'

/** Sets `document.title` for the current route, restoring the previous title on unmount. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}
