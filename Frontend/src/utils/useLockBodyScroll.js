import { useEffect } from 'react'

export function useLockBodyScroll(isLocked) {
  useEffect(() => {
    if (!isLocked) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Cleanup: put the page's scrolling back to how it was.
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isLocked])
}