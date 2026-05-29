'use client'
// src/app/dashboard/page.tsx
import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenBusinesses, listenMessages } from '@/lib/db'
import type { Business, Message } from '@/types'
import { Building2, Send, CheckCircle2, Clock, AlertCircle, Inbox } from 'lucide-react'
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

  const isHQ    = user.role === 'HQ_CHIEF' || user.role === 'HQ_MEMBER'
  const isAdmin = user.role === 'ADMIN'
  const isBizRep = user.role === 'BIZ_REP'

  // 본부/관리자 통계
  const sentMsgs     = messages.filter(m => m.fromUid === user.uid)
  const totalPending = messages.reduce((a, m) => a + m.receipts.filter(r => r.status === 'pending').length, 0)
  const totalReplied = messages.reduce((a, m) => a + m.receipts.filter(r => r.status === 'replied').length, 0)

  // 사업장대표 통계
  const myReceivedMsgs = messages.filter(m => m.receipts.find(r => r.bizId === user.bizId))
  const myPending      = myReceivedMsgs.filter(m => m.receipts.find(r => r.bizId === user.bizId && r.status === 'pending')).length
  const myDone         = myReceivedMsgs.filter(m => m.receipts.find(r => r.bizId === user.bizId && r.status !== 'pending')).length
  const mySentMsgs     = messages.filter(m => m.fromUid === user.uid)

  const relTime = (iso: string) => {
    try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ko }) } catch { return iso }
  }

  const recentMsgs = [...messages]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">대시보드</h1>
          <p className="text-sm text-gray-500 mt-0.5">{user.name}님, 안녕하세요.</p>
        </div>

        {/* 통계 카드 - 본부/관리자 */}
        {(isHQ || isAdmin) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="관리 사업장"  value={businesses.length}  Icon={Building2}    color="purple" />
            <StatCard label="보낸 메시지"  value={sentMsgs.length}    Icon={Send}         color="blue" />
            <StatCard label="미접수"       value={totalPending}       Icon={AlertCircle}  color="red" />
            <StatCard label="답변 완료"    value={totalReplied}       Icon={CheckCircle2} color="green" />
          </div>
        )}

        {/* 통계 카드 - 사업장대표 */}
        {isBizRep && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="받은 메시지"  value={myReceivedMsgs.length} Icon={Inbox}        color="blue" />
            <StatCard label="미확인"       value={myPending}              Icon={Clock}        color="red" />
            <StatCard label="처리 완료"    value={myDone}                 Icon={CheckCircle2} color="green" />
            <StatCard label="보낸 메시지"  value={mySentMsgs.length}      Icon={Send}         color="purple" />
          </div>
        )}

        {/* 최근 받은 메시지 (사업장대표) */}
        {isBizRep && myReceivedMsgs.length > 0 && (
          <div className="card overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">받은 메시지</h2>
            </div>
            <ul className="divide-y divide-gray-50">
              {myReceivedMsgs.slice(0, 5).map(m => {
                const receipt = m.receipts.find(r => r.bizId === user.bizId)
                return (
                  <li key={m.id}>
                    <Link href={`/businesses/${user.bizId}?msg=${m.id}`}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className={m.priority === 'urgent' ? 'badge-urgent' : 'badge-normal'}>
                            {m.priority === 'urgent' ? '긴급' : '일반'}
                          </span>
                          {receipt && (
                            <span className={clsx(
                              receipt.status === 'pending'  ? 'badge-pending'  :
                              receipt.status === 'received' ? 'badge-received' : 'badge-replied'
                            )}>
                              {receipt.status === 'pending' ? '미접수' : receipt.status === 'received' ? '접수확인' : '답변완료'}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 ml-auto">{relTime(m.createdAt)}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{m.fromName}</p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* 보낸 메시지 (사업장대표) */}
        {isBizRep && mySentMsgs.length > 0 && (
          <div className="card overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">보낸 메시지</h2>
            </div>
            <ul className="divide-y divide-gray-50">
              {mySentMsgs.slice(0, 3).map(m => (
                <li key={m.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{relTime(m.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 최근 전달사항 (본부/관리자) */}
        {(isHQ || isAdmin) && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">최근 전달/지시사항</h2>
              <Link href="/compose" className="text-xs text-primary-600 hover:underline">+ 새 전달</Link>
            </div>
            {recentMsgs.length === 0
              ? <div className="py-12 text-center text-sm text-gray-400">전달사항이 없습니다</div>
              : <ul className="divide-y divide-gray-50">
                  {recentMsgs.map(m => {
                    const pendingCnt = m.receipts.filter(r => r.status === 'pending').length
                    const biz = businesses.find(b => b.id === m.targetBizIds[0])
                    const isMine = m.fromUid === user.uid
                    return (
                      <li key={m.id}>
                        <Link href={`/messages/${m.id}`}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                                isMine ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                                {isMine ? '내가 보냄' : m.fromName}
                              </span>
                              <span className={m.priority === 'urgent' ? 'badge-urgent' : 'badge-normal'}>
                                {m.priority === 'urgent' ? '긴급' : '일반'}
                              </span>
                              {m.targetBizIds.length === 1 && biz && (
                                <span className="text-[11px] text-gray-400">→ {biz.name}</span>
                              )}
                              {m.targetBizIds.length > 1 && (
                                <span className="text-[11px] text-gray-400">→ {m.targetBizIds.length}개 사업장</span>
                              )}
                              {pendingCnt > 0 && (
                                <span className="text-[10px] font-semibold text-red-600 bg-red-50 rounded-full px-1.5 py-0.5">
                                  미접수 {pendingCnt}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400 ml-auto">{relTime(m.createdAt)}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
            }
          </div>
        )}
      </div>
    </AppShell>
  )
}

function StatCard({ label, value, Icon, color }: {
  label: string; value: number; Icon: React.ElementType; color: string
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
