'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenUsers, sendDirectMessage } from '@/lib/db'
import type { AppUser } from '@/types'
import { Send, MessageSquare, Lock } from 'lucide-react'

export default function DirectPage() {
  const { user } = useAuth()
  const router   = useRouter()

  const [hqMembers, setHqMembers] = useState<AppUser[]>([])
  const [targetUid, setTargetUid] = useState('')
  const [title,     setTitle]     = useState('')
  const [body,      setBody]      = useState('')
  const [priority,  setPriority]  = useState<'normal' | 'urgent'>('normal')
  const [sending,   setSending]   = useState(false)
  const [sent,      setSent]      = useState(false)

  const isBiz = user?.role === 'BIZ_REP'

  useEffect(() => {
    if (!isBiz) { router.replace('/dashboard'); return }
    const unsub = listenUsers(users => {
      // 본부장 + 본부멤버 + 관리자만 수신 가능
      setHqMembers(users.filter(u =>
        u.role === 'ADMIN' || u.role === 'HQ_CHIEF' || u.role === 'HQ_MEMBER'
      ))
    })
    return unsub
  }, [isBiz, router])

  const handleSend = async () => {
    if (!user?.bizId || !targetUid || !title.trim() || !body.trim()) return
    setSending(true)
    const target = hqMembers.find(m => m.uid === targetUid)
    if (!target) { setSending(false); return }
    await sendDirectMessage({
      title:       title.trim(),
      body:        body.trim(),
      priority,
      authorUid:   user.uid,
      authorName:  user.name,
      authorBizId: user.bizId,
      targetUid:   target.uid,
      targetName:  target.name,
    })
    setSent(true)
    setSending(false)
  }

  if (sent) return (
    <AppShell title="1:1 메시지" back="/dashboard">
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <MessageSquare size={32} className="text-green-600"/>
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-900">전송 완료!</p>
          <p className="text-sm text-gray-500 mt-1">담당자에게 메시지가 전달됐습니다</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setSent(false); setTitle(''); setBody(''); setTargetUid('') }}
            className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">
            새 메시지 작성
          </button>
          <button onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-800">
            대시보드로
          </button>
        </div>
      </div>
    </AppShell>
  )

  return (
    <AppShell title="1:1 메시지" back="/dashboard">
      <div className="max-w-lg mx-auto p-4 md:p-6 space-y-4">

        {/* 안내 */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <Lock size={16} className="text-blue-500 shrink-0 mt-0.5"/>
          <p className="text-xs text-blue-700 leading-relaxed">
            이 메시지는 수신 담당자와 관리자만 볼 수 있습니다.<br/>
            다른 사업장이나 본부 멤버에게는 노출되지 않습니다.
          </p>
        </div>

        {/* 수신자 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">받는 사람</label>
          <select value={targetUid} onChange={e => setTargetUid(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
            <option value="">담당자를 선택하세요</option>
            {hqMembers.map(m => (
              <option key={m.uid} value={m.uid}>
                {m.name} ({m.role === 'ADMIN' ? '관리자' : m.role === 'HQ_CHIEF' ? '본부장' : '본부멤버'})
              </option>
            ))}
          </select>
        </div>

        {/* 우선순위 */}
        <div className="flex gap-2">
          {(['normal', 'urgent'] as const).map(p => (
            <button key={p} onClick={() => setPriority(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                priority === p
                  ? p === 'urgent' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-primary-50 border-primary-300 text-primary-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {p === 'normal' ? '일반' : '🚨 긴급'}
            </button>
          ))}
        </div>

        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">제목</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="문의 제목을 입력하세요"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
        </div>

        {/* 내용 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">내용</label>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="내용을 입력하세요"
            rows={6}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
        </div>

        <button onClick={handleSend}
          disabled={!targetUid || !title.trim() || !body.trim() || sending}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white rounded-xl py-3.5 font-medium text-sm hover:bg-primary-800 disabled:opacity-50 transition-colors">
          <Send size={16}/> {sending ? '전송 중...' : '메시지 전송'}
        </button>
      </div>
    </AppShell>
  )
}
