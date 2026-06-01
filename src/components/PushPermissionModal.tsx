'use client'
import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import { subscribePush } from '@/lib/push'
import { useAuth } from '@/lib/auth-context'
import { useSettings } from '@/lib/settings-context'

interface Props { onClose: () => void }

export default function PushPermissionModal({ onClose }: Props) {
  const { user }             = useAuth()
  const { updateSettings }   = useSettings()
  const [loading, setLoading] = useState(false)

  const handleAllow = async () => {
    if (!user) return
    setLoading(true)
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      const ok = await subscribePush(user.uid)
      if (ok) await updateSettings({ pushEnabled: true })
    }
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center">
            <Bell size={24} className="text-primary-600"/>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20}/>
          </button>
        </div>
        <h2 className="font-bold text-gray-900 text-lg mb-2">푸시 알림 허용</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          새 전달, 공지사항, 일정 알림을 실시간으로 받을 수 있습니다.
          중요한 업무를 놓치지 마세요.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            나중에
          </button>
          <button onClick={handleAllow} disabled={loading}
            className="flex-1 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-800 disabled:opacity-60">
            {loading ? '처리 중...' : '허용하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
