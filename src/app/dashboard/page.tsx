'use client'
// src/app/dashboard/page.tsx
import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenBusinesses, listenMessages } from '@/lib/db'
import type { Business, Message } from '@/types'
import { Building2, Send, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import clsx from 'clsx'

export default function DashboardPage() {
  const { user } = useAuth()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [messages,   setMessages]   = useState<Message[]>([])

  useEffect(() => {
    if (!user) return
    const u1 = listenBusinesses(setBusinesses)
    const u2 = listenMessages(
      user.role === 'BIZ_REP' ? (user.bizId ?? null) : null,
      setMessages
    )
    return () => { u1(); u2() }
  }, [user])

  if (!user) return null

  const isHQ = user.role === 'HQ_CHIEF' || user.role === 'HQ_MEMBER'

  const totalPending = messages.reduce(
    (a, m) => a + m.receipts.filter(r => r.status === 'pending').length, 0
  )
  const totalReplied  = messages.reduce(
    (a, m) => a + m.receipts.filter(r => r.status === 'replied').length, 0
  )
  const totalReceived = messages.reduce(
    (a, m) => a + m.receipts.filter(r => r.status === 'received').length, 0
  )

  // 사업장 대표: 내 메시지 통계
  const myPending  = messages.filter(m => m.receipts.find(r => r.bizId === user.bizId && r.status === 'pending')).length
  const myReceived = messages.filter(m => m.receipts.find(r => r.bizId === user.bizId && r.status !== 'pending')).length

  const recentMsgs = [...messages]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  const relTime = (iso: string) => {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ko })
    } catch { return iso }
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">대시보드</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {user.name}님, 안녕하세요.
          </p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {isHQ ? (
            <>
              <StatCard label="관리 사업장" value={businesses.length} Icon={Building2} color="purple" />
              <StatCard label="전체 전달건" value={messages.length} Icon={Send} color="blue" />
              <StatCard label="미접수" value={totalPending} Icon={AlertCircle} color="red" />
              <StatCard label="답변 완료" value={totalReplied} Icon={CheckCircle2} color="green" />
            </>
          ) : (
            <>
              <StatCard label="전달받은 건수" value={messages.length} Icon={Send} color="blue" />
              <StatCard label="미확인" value={myPending} Icon={Clock} color="red" />
              <StatCard label="처리 완료" value={myReceived} Icon={CheckCircle2} color="green" />
            </>
          )}
        </div>

        {/* 최근 전달사항 */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">최근 전달/지시사항</h2>
            {isHQ && (
              <Link href="/compose" className="text-xs text-primary-600 hover:underline">
                + 새 전달
              </Link>
            )}
          </div>
          {recentMsgs.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">전달사항이 없습니다</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentMsgs.map(m => {
                const myReceipt = m.receipts.find(r => r.bizId === user.bizId)
                const pendingCnt = m.receipts.filter(r => r.status === 'pending').length
                const biz = businesses.find(b => b.id === m.targetBizIds[0])
                return (
                  <li key={m.id}>
                    <Link
                      href={isHQ ? `/messages/${m.id}` : `/businesses/${user.bizId}?msg=${m.id}`}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className={m.priority === 'urgent' ? 'badge-urgent' : 'badge-normal'}>
                            {m.priority === 'urgent' ? '긴급' : '일반'}
                          </span>
                          {isHQ && m.targetBizIds.length > 1 && (
                            <span className="text-[11px] text-gray-400">{m.targetBizIds.length}개 사업장</span>
                          )}
                          {isHQ && m.targetBizIds.length === 1 && biz && (
                            <span className="text-[11px] text-gray-400">{biz.name}</span>
                          )}
                          {isHQ && pendingCnt > 0 && (
                            <span className="text-[10px] font-semibold text-red-600 bg-red-50 rounded-full px-1.5 py-0.5">
                              미접수 {pendingCnt}
                            </span>
                          )}
                          {!isHQ && myReceipt && (
                            <span className={clsx(
                              myReceipt.status === 'pending'  ? 'badge-pending'  :
                              myReceipt.status === 'received' ? 'badge-received' : 'badge-replied'
                            )}>
                              {myReceipt.status === 'pending' ? '미접수' : myReceipt.status === 'received' ? '접수' : '답변완료'}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{m.fromName} · {relTime(m.createdAt)}</p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  )
}

function StatCard({ label, value, Icon, color }: {
  label: string; value: number
  Icon: React.ElementType; color: string
}) {
  const colors: Record<string, string> = {
    purple: 'bg-primary-50 text-primary-600',
    blue:   'bg-blue-50 text-blue-600',
    red:    'bg-red-50 text-red-600',
    green:  'bg-green-50 text-green-600',
  }
  return (
    <div className="card p-4">
      <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center mb-2', colors[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}
