'use client'
// src/app/messages/[id]/page.tsx
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenMessages } from '@/lib/db'
import type { Message } from '@/types'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

export default function MessageDetailPage() {
  const { id }       = useParams<{ id: string }>()
  const { user }     = useAuth()
  const [msg, setMsg] = useState<Message | null>(null)

  useEffect(() => {
    const unsub = listenMessages(null, msgs => {
      setMsg(msgs.find(m => m.id === id) ?? null)
    })
    return unsub
  }, [id])

  if (!msg) return <AppShell><div className="p-6 text-sm text-gray-400">로딩 중...</div></AppShell>

  const pendingCnt  = msg.receipts.filter(r => r.status === 'pending').length
  const receivedCnt = msg.receipts.filter(r => r.status === 'received').length
  const repliedCnt  = msg.receipts.filter(r => r.status === 'replied').length

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <Link href="/dashboard" className="btn text-xs mb-4 inline-flex">
          <ChevronLeft className="w-4 h-4" /> 대시보드
        </Link>

        {/* 제목/본문 */}
        <div className="card p-5 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 mb-1">{msg.title}</h1>
              <div className="text-xs text-gray-400">
                {msg.fromName} · {msg.createdAt.slice(0, 16).replace('T', ' ')}
              </div>
            </div>
            <span className={msg.priority === 'urgent' ? 'badge-urgent' : 'badge-normal'}>
              {msg.priority === 'urgent' ? '긴급' : '일반'}
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.body}</p>
        </div>

        {/* 접수 현황 요약 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: '미접수', cnt: pendingCnt, cls: 'text-amber-700 bg-amber-50' },
            { label: '접수확인', cnt: receivedCnt, cls: 'text-blue-700 bg-blue-50' },
            { label: '답변완료', cnt: repliedCnt, cls: 'text-green-700 bg-green-50' },
          ].map(({ label, cnt, cls }) => (
            <div key={label} className={`rounded-xl p-3 text-center ${cls}`}>
              <div className="text-2xl font-semibold">{cnt}</div>
              <div className="text-xs font-medium mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* 사업장별 접수 현황 */}
        <div className="card overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">
            사업장별 접수 현황
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="text-left px-4 py-2">사업장</th>
                <th className="text-left px-4 py-2">상태</th>
                <th className="text-left px-4 py-2">처리일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {msg.receipts.map(r => (
                <tr key={r.bizId}>
                  <td className="px-4 py-2.5">
                    <Link href={`/businesses/${r.bizId}`} className="text-primary-700 hover:underline font-medium">
                      {r.bizName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={clsx(
                      r.status === 'pending'  ? 'badge-pending'  :
                      r.status === 'received' ? 'badge-received' : 'badge-replied'
                    )}>
                      {r.status === 'pending' ? '미접수' : r.status === 'received' ? '접수확인' : '답변완료'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {r.repliedAt ?? r.receivedAt ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 답변 스레드 */}
        {msg.replies.length > 0 && (
          <div className="card p-4">
            <div className="text-xs font-semibold text-gray-500 mb-3">답변 내역</div>
            <div className="flex flex-col gap-3">
              {msg.replies.map(r => (
                <div key={r.id} className="flex items-start gap-2.5">
                  <div className={clsx(
                    'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0',
                    r.role === 'BIZ_REP' ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-700'
                  )}>
                    {r.fromName[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-1.5 mb-0.5">
                      <span className="text-xs font-medium text-gray-900">{r.fromName}</span>
                      <span className="text-[10px] text-gray-400">
                        {r.role === 'BIZ_REP' ? '사업장대표' : '본부'}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-auto">{r.createdAt.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <div className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
                      {r.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
