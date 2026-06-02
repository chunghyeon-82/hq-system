'use client'
import { useState } from 'react'
import { Bell, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { subscribePush } from '@/lib/push'
import { useAuth } from '@/lib/auth-context'
import { useSettings } from '@/lib/settings-context'

interface Props { onClose: () => void }

export default function PushPermissionModal({ onClose }: Props) {
  const { user }              = useAuth()
  const { updateSettings }    = useSettings()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState(false)

  const handleAllow = async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        const result = await subscribePush(user.uid)
        if (result.ok) {
          await updateSettings({ pushEnabled: true })
          setSuccess(true)
          setTimeout(() => onClose(), 1500)
        } else {
          setError(result.error || '알림 등록에 실패했습니다')
        }
      } else if (permission === 'denied') {
        setError('브라우저에서 알림을 차단했습니다. 브라우저 설정에서 허용해주세요.')
      } else {
        onClose()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${success ? 'bg-green-50' : 'bg-primary-50'}`}>
            {success
              ? <CheckCircle2 size={24} className="text-green-500"/>
              : <Bell size={24} className="text-primary-600"/>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20}/>
          </button>
        </div>
        {success ? (
          <>
            <h2 className="font-bold text-gray-900 text-lg mb-2">알림 등록 완료!</h2>
            <p className="text-sm text-gray-500">이제 새 전달과 공지사항 알림을 받을 수 있습니다.</p>
          </>
        ) : (
          <>
            <h2 className="font-bold text-gray-900 text-lg mb-2">푸시 알림 허용</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              새 전달, 공지사항, 일정 알림을 실시간으로 받을 수 있습니다.
              중요한 업무를 놓치지 마세요.
            </p>
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5"/>
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
                나중에
              </button>
              <button onClick={handleAllow} disabled={loading}
                className="flex-1 py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-800 disabled:opacity-60">
                {loading ? '등록 중...' : '허용하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
