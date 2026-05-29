'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenBusinesses, sendMessage } from '@/lib/db'
import type { Business, Receipt } from '@/types'
import { Send, CheckSquare, Square, AlertCircle } from 'lucide-react'

function ComposeContent() {
  const { user }     = useAuth()
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [title,      setTitle]      = useState('')
  const [body,       setBody]       = useState('')
  const [priority,   setPriority]   = useState<'normal' | 'urgent'>('normal')
  const [sending,    setSending]    = useState(false)
  const [sent,       setSent]       = useState(false)

  const canSend = user?.role === 'ADMIN' || user?.role === 'HQ_CHIEF' || user?.role === 'HQ_MEMBER'

  useEffect(() => {
    if (!canSend) { router.replace('/dashboard'); return }
    const unsub = listenBusinesses(setBusinesses)
    return unsub
  }, [canSend, router])

  useEffect(() => {
    const bizId = searchParams.get('biz')
    if (bizId) setSelected(new Set([bizId]))
  }, [searchParams])

  const toggleAll = () => setSelected(
    selected.size === businesses.length ? new Set() : new Set(businesses.map(b => b.id))
  )
  const toggle = (bizId: string) => {
    const next = new Set(selected)
    next.has(bizId) ? next.delete(bizId) : next.add(bizId)
    setSelected(next)
  }

  const handleSend = async () => {
    if (!user || !title.trim() || !body.trim() || selected.size === 0) return
    setSending(true)
    const receipts: Receipt[] = Array.from(selected).map(bizId => ({
      bizId,
      bizName: businesses.find(b => b.id === bizId)?.name ?? bizId,
      status: 'pending' as const,
    }))
    await sendMessage({
      title: title.trim(), body: body.trim(), priority,
      authorUid: user.uid, authorName: user.name,
      targetBizIds: Array.from(selected),
      receipts,
    })
    setSent(true)
    setSending(false)
  }

  if (sent) return (
    <AppShell title="전달 작성">
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <CheckSquare size={32} className="text-green-600"/>
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-900">발송 완료!</p>
          <p className="text-sm text-gray-500 mt-1">{selected.size}개 사업장에 전달되었습니다</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setSent(false); setTitle(''); setBody(''); setSelected(new Set()) }}
            className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">
            새 전달 작성
          </button>
          <button onClick={() => router.push('/businesses')}
            className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-800">
            사업장 현황 보기
          </button>
        </div>
      </div>
    </AppShell>
  )

  return (
    <AppShell title="전달 작성">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
        {/* 우선순위 */}
        <div className="flex gap-2">
          {(['normal', 'urgent'] as const).map(p => (
            <button key={p} onClick={() => setPriority(p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                priority === p
                  ? p === 'urgent' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-primary-50 border-primary-300 text-primary-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {p === 'urgent' && <AlertCircle size={15}/>}
              {p === 'normal' ? '일반' : '긴급'}
            </button>
          ))}
        </div>

        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">제목</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="전달 제목을 입력하세요"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
        </div>

        {/* 내용 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">내용</label>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="전달 내용을 입력하세요"
            rows={6}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
        </div>

        {/* 수신 사업장 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">수신 사업장 ({selected.size}/{businesses.length})</label>
            <button onClick={toggleAll} className="text-xs text-primary-600 hover:underline font-medium">
              {selected.size === businesses.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {businesses.map(biz => (
              <button key={biz.id} onClick={() => toggle(biz.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                  selected.has(biz.id) ? 'bg-primary-50' : 'bg-white'
                }`}>
                {selected.has(biz.id)
                  ? <CheckSquare size={18} className="text-primary-600 shrink-0"/>
                  : <Square size={18} className="text-gray-300 shrink-0"/>}
                <span className="text-sm font-medium text-gray-800">{biz.name}</span>
                {biz.repName && <span className="text-xs text-gray-400 ml-auto">{biz.repName}</span>}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleSend}
          disabled={!title.trim() || !body.trim() || selected.size === 0 || sending}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white rounded-xl py-3.5 font-medium text-sm hover:bg-primary-800 disabled:opacity-50 transition-colors">
          <Send size={16}/> {sending ? '발송 중...' : `${selected.size}개 사업장에 발송`}
        </button>
      </div>
    </AppShell>
  )
}

export default function ComposePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"/></div>}>
      <ComposeContent/>
    </Suspense>
  )
}
