'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { listenBusinesses, listenMessages } from '@/lib/db'
import type { Business, Message } from '@/types'
import { Building2, Send, Clock, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const [business,  setBusiness]  = useState<Business | null>(null)
  const [messages,  setMessages]  = useState<Message[]>([])
  const [filter,    setFilter]    = useState<'all' | 'open' | 'done'>('all')

  useEffect(() => {
    const u1 = listenBusinesses(bizs => setBusiness(bizs.find(b => b.id === id) ?? null))
    const u2 = listenMessages(msgs => setMessages(
      msgs.filter(m => m.targetBizIds.includes(id))
    ))
    return () => { u1(); u2() }
  }, [id])

  const filtered = messages.filter(m =>
    filter === 'all' ? true : m.status === filter
  )

  const openCount  = messages.filter(m => m.status === 'open').length
  const doneCount  = messages.filter(m => m.status === 'done').length
  const pendCount  = messages.reduce((acc, m) => {
    const r = m.receipts?.find(r => r.bizId === id)
    return acc + (r?.status === 'pending' ? 1 : 0)
  }, 0)

  if (!business) return (
    <AppShell title="사업장 상세" back="/businesses">
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">불러오는 중...</div>
    </AppShell>
  )

  return (
    <AppShell title={business.name} back="/businesses">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
        {/* 사업장 정보 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
              <Building2 size={22} className="text-primary-600"/>
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-gray-900 text-base">{business.name}</h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                {business.repName && <p className="text-xs text-gray-500"><span className="text-gray-400">대표</span> {business.repName}</p>}
                {business.phone   && <p className="text-xs text-gray-500"><span className="text-gray-400">연락처</span> {business.phone}</p>}
                {business.address && <p className="text-xs text-gray-500 col-span-2"><span className="text-gray-400">주소</span> {business.address}</p>}
              </div>
            </div>
          </div>
          {/* 통계 */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
            {[
              { label: '진행중', value: openCount, color: 'text-amber-600' },
              { label: '완결',   value: doneCount, color: 'text-green-600' },
              { label: '미접수', value: pendCount, color: pendCount > 0 ? 'text-red-600' : 'text-gray-400' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={clsx('text-lg font-bold', s.color)}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 전달 작성 버튼 */}
        <button onClick={() => router.push(`/compose?biz=${id}`)}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white rounded-xl py-3 font-medium text-sm hover:bg-primary-800 transition-colors">
          <Send size={15}/> 이 사업장에 전달 작성
        </button>

        {/* 메시지 목록 필터 */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['all', 'open', 'done'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx(
                'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filter === f ? 'bg-white shadow text-gray-900' : 'text-gray-500'
              )}>
              {f === 'all' ? `전체 ${messages.length}` : f === 'open' ? `진행중 ${openCount}` : `완결 ${doneCount}`}
            </button>
          ))}
        </div>

        {/* 메시지 목록 */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm bg-white border border-gray-100 rounded-xl">
              전달 내역이 없습니다
            </div>
          )}
          {filtered.map(msg => {
            const myReceipt = msg.receipts?.find(r => r.bizId === id)
            const isDone    = msg.status === 'done'
            return (
              <button key={msg.id}
                onClick={() => router.push(`/messages/${msg.id}`)}
                className={clsx(
                  'w-full text-left border rounded-xl p-4 hover:shadow-sm transition-all group',
                  isDone ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-white border-gray-200 hover:border-primary-200'
                )}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {msg.priority === 'urgent' && <span className="badge-urgent">긴급</span>}
                      <span className={isDone ? 'badge-done' : 'badge-open'}>
                        {isDone ? '완결' : '진행중'}
                      </span>
                      <span className={
                        myReceipt?.status === 'replied'  ? 'badge-replied' :
                        myReceipt?.status === 'received' ? 'badge-received' : 'badge-pending'
                      }>
                        {myReceipt?.status === 'replied'  ? '답변완료' :
                         myReceipt?.status === 'received' ? '접수확인' : '미접수'}
                      </span>
                    </div>
                    <p className="font-medium text-sm text-gray-900 truncate">{msg.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{msg.authorName}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400 shrink-0"/>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
