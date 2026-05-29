'use client'
import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // 이미 설치됐으면 숨김
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (sessionStorage.getItem('pwa-prompt-dismissed')) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIOS(ios)

    if (ios) {
      setTimeout(() => setShow(true), 3000)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setTimeout(() => setShow(true), 3000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setShow(false)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShow(false)
    sessionStorage.setItem('pwa-prompt-dismissed', '1')
  }

  if (!show || dismissed) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-sm mx-auto">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shrink-0">
            <Download size={18} className="text-white"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900">앱으로 설치하기</p>
            {isIOS ? (
              <p className="text-xs text-gray-500 mt-0.5">
                Safari 하단 <strong>공유 버튼 →</strong> <strong>홈 화면에 추가</strong>를 탭하세요
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-0.5">
                홈 화면에 추가하면 앱처럼 바로 사용할 수 있어요
              </p>
            )}
          </div>
          <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X size={16}/>
          </button>
        </div>
        {!isIOS && (
          <button onClick={handleInstall}
            className="w-full mt-3 bg-primary-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-primary-800 transition-colors">
            홈 화면에 추가
          </button>
        )}
      </div>
    </div>
  )
}
