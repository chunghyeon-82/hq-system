'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useSettings } from '@/lib/settings-context'
import PushPermissionModal from './PushPermissionModal'

export default function PushInit() {
  const { user }           = useAuth()
  const { settings }       = useSettings()
  const [show, setShow]    = useState(false)

  useEffect(() => {
    if (!user) return
    if (settings.pushEnabled) return
    if (!('Notification' in window)) return
    if (Notification.permission !== 'default') return

    // 첫 로그인 후 2초 뒤 팝업
    const shown = sessionStorage.getItem('pushPromptShown')
    if (shown) return
    const t = setTimeout(() => {
      sessionStorage.setItem('pushPromptShown', '1')
      setShow(true)
    }, 2000)
    return () => clearTimeout(t)
  }, [user, settings.pushEnabled])

  if (!show) return null
  return <PushPermissionModal onClose={() => setShow(false)}/>
}
