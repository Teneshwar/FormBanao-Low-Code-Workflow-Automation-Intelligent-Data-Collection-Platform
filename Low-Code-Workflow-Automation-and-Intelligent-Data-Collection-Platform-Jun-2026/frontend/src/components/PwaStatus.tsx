import { useEffect, useState } from 'react'

export default function PwaStatus() {
  const [swController, setSwController] = useState<boolean | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<boolean | null>(null)

  useEffect(() => {
    setSwController(!!navigator.serviceWorker && !!navigator.serviceWorker.controller)
    setDeferredPrompt(!!(window as any).deferredPrompt)

    function onControllerChange() {
      setSwController(!!navigator.serviceWorker && !!navigator.serviceWorker.controller)
    }

    function onDeferred() {
      setDeferredPrompt(!!(window as any).deferredPrompt)
    }

    navigator.serviceWorker?.addEventListener?.('controllerchange', onControllerChange)
    window.addEventListener('pwa-beforeinstallprompt', onDeferred)

    return () => {
      navigator.serviceWorker?.removeEventListener?.('controllerchange', onControllerChange)
      window.removeEventListener('pwa-beforeinstallprompt', onDeferred)
    }
  }, [])

  return (
    <div className="text-xs text-gray-400">
      <div>SW controller: {swController === null ? 'unknown' : swController ? 'yes' : 'no'}</div>
      <div>deferredPrompt: {deferredPrompt === null ? 'unknown' : deferredPrompt ? 'available' : 'none'}</div>
    </div>
  )
}
