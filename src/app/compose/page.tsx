'use client'
// src/app/compose/page.tsx
import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenBusinesses, sendMessage } from '@/lib/db'
import type { Business, Receipt } from '@/types'
import { Send, CheckSquare, Square } from 'lucide-react'

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

  // 관리자, 본부장, 본부멤버 모두 전달 작성 가능
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

  const toggleAll = () => {
    if (selected.size === businesses.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(businesses.map(b => b.id)))
    }
  }

  const toggle = (bizId: string) => {
    const next = new Set(selected)
    next.has(bizId) ? next.delete(bizId) : next.add(bizId)
    setSelected(next)
  }

  const handleSend = async () => {
    if (!user || !title.trim() || !body.trim() || selected.size === 0) return
    setSending(true)
    const targetBizIds = Array.from(selected)
    const receipts: Receipt[] = targetBizIds.map(bizId => ({
      bizId,
      bizName: businesses.find(b => b.id === bizId)?.name ?? bizId,
      status: 'pending',
    }))
    await sendMessage({
      title: title.trim(),
      body: body.trim(),
      priority,
      fromUid: user.uid,
      fromName: user.name,
      fromRole: user.role,
      targetBizIds,
      receipts,
    })
    setSent(true)
    setSending(false)
  }

  if (sent) {
    return (
      <AppShell>
        <div className="p-6 max-w-xl mx-auto flex flex-col items-center gap-4 mt-16">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
            <CheckSquare className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">전달 완료</h2>
          <p className="text-sm text-gray-500 text-center">
            {selected.size}개 사업장에 전달사항이 발송되었습니다.
          </p>
          <div className="flex gap-3 mt-2">
            <button onClick={() => { setTitle(''); setBody(''); setSelected(new Set()); setSent(false) }} className="btn">
              새 전달 작성
            </button>
            <button onClick={() => router.replace('/dashboard')} className="btn btn-primary">
              대시보드로
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">전달/지시 작성</h1>
          <p className="text-sm text-gray-500 mt-0.5">사업장 대표에게 전달사항을 발송합니다. 모든 기록이 저장됩니다.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">수신 사업장 선택</h2>
              <button onClick={toggleAll} className="btn text-xs gap-1.5">
                {selected.size === businesses.length
                  ? <><CheckSquare className="w-3.5 h-3.5 text-primary-600" /> 전체 해제</>
                  : <><Square className="w-3.5 h-3.5" /> 전체 선택</>}
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {businesses.map(b => {
                const checked = selected.has(b.id)
                return (
                  <button key={b.id} onClick={() => toggle(b.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left text-sm transition-all ${
                      checked ? 'border-primary-400 bg-primary-50 text-primary-800' : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200'
                    }`}>
                    {checked ? <CheckSquare className="w-4 h-4 text-primary-600 flex-shrink-0" /> : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                    <span className="truncate font-medium">{b.name}</span>
                  </button>
                )
              })}
            </div>
            {selected.size > 0 && (
              <p className="text-xs text-primary-700 mt-3 font-medium">
                {selected.size}개 사업장 선택됨{selected.size === businesses.length && ' (전체)'}
              </p>
            )}
          </div>

          <div className="card p-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">제목 *</label>
              <input className="input" placeholder="전달사항 제목을 입력하세요" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">내용 *</label>
              <textarea className="input resize-none min-h-[160px] text-sm leading-relaxed" placeholder="전달할 내용을 자세히 입력하세요" value={body} onChange={e => setBody(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">중요도</label>
              <div className="flex gap-2">
                {([['normal', '일반'], ['urgent', '긴급']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setPriority(v)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                      priority === v
                        ? v === 'urgent' ? 'border-red-400 bg-red-50 text-red-700' : 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-gray-100 bg-white text-gray-500 hover:bg-gray-50'
                    }`}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          <button onClick={handleSend} disabled={!title.trim() || !body.trim() || selected.size === 0 || sending}
            className="btn btn-primary w-full justify-center py-3 text-base">
            <Send className="w-4 h-4" />
            {sending ? '전송 중...' : `${selected.size}개 사업장에 발송`}
          </button>
        </div>
      </div>
    </AppShell>
  )
}

export default function ComposePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">로딩 중...</div>}>
      <ComposeContent />
    </Suspense>
  )
}
