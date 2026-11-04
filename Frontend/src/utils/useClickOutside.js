import { useEffect } from 'react'

export function useClickOutside(ref, onOutside) {
  useEffect(() => {
    function handleMouseDown(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        onOutside()
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') onOutside()
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)

    // Cleanup: remove the listeners when the component disappears.
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [ref, onOutside])
}