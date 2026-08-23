import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import toast from 'react-hot-toast'

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  useEffect(() => {
    // If app is already running in standalone, mark installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    // If the inline script stored a deferred prompt before React mounted, pick it up
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt)
      console.debug('[PWA] found window.deferredPrompt on mount')
    }

    function beforeInstallHandler(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e)
      console.debug('[PWA] beforeinstallprompt event captured')
    }

    function appInstalledHandler() {
      setIsInstalled(true)
      setDeferredPrompt(null)
      toast.success('App installed')
    }

    function customHandler() {
      if ((window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt)
      }
    }

    window.addEventListener('beforeinstallprompt', beforeInstallHandler as EventListener)
    window.addEventListener('appinstalled', appInstalledHandler)
    window.addEventListener('pwa-beforeinstallprompt', customHandler as EventListener)

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstallHandler as EventListener)
      window.removeEventListener('appinstalled', appInstalledHandler)
      window.removeEventListener('pwa-beforeinstallprompt', customHandler as EventListener)
    }
  }, [])

  const handleInstallClick = async () => {
    if (isInstalled) {
      toast('App is already installed')
      return
    }

    if (deferredPrompt) {
      try {
        await (deferredPrompt as any).prompt()
        const choiceResult = await (deferredPrompt as any).userChoice
        setDeferredPrompt(null)
        if (choiceResult && choiceResult.outcome === 'accepted') {
          setIsInstalled(true)
          toast.success('Thanks for installing!')
        } else {
          toast('Installation dismissed')
        }
      } catch (err) {
        setDeferredPrompt(null)
        toast.error('Installation failed')
      }
    } else {
      // Show a helpful modal with explicit instructions instead of only a toast
      setShowInstructions(true)
    }
  }

  if (isInstalled) return null

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title="Install app"
        className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
      >
        <Download className="w-4 h-4" />
      </button>

      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowInstructions(false)} />
          <div className="relative bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2">Install Form बनाओ</h3>
            <p className="text-sm text-gray-600 mb-4">Your browser did not provide the automatic install prompt. Follow these steps to install the app:</p>
            <ol className="list-decimal list-inside text-sm text-gray-700 space-y-2 mb-4">
              <li>Desktop Chrome: Click the browser menu (⋮) → "Install app" or click the install icon in the address bar.</li>
              <li>Chrome (mobile): Open the browser menu → "Add to Home screen".</li>
              <li>Safari (iOS): Tap the Share button → "Add to Home Screen".</li>
            </ol>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowInstructions(false)} className="px-3 py-1 rounded bg-gray-100">Close</button>
              <a href="/manifest.webmanifest" target="_blank" rel="noreferrer" className="px-3 py-1 rounded bg-primary-600 text-white">Open Manifest</a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
