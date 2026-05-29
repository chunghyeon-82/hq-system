'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenMessages, listenMessagesByBiz, listenBusinesses } from '@/lib/db'
import type { Message, Business } from '@/types'
import { Send, CheckCircle2, Clock, AlertCircle, Building2, ChevronRight, ArrowRight } from 'lucide-react'
import clsx from 'clsx'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [messages,   setMessages]   = useState<Message[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])

  const isHQ = user?.role === 'ADMIN' || user?.role === 'HQ_CHIEF' || user?.role === 'HQ_MEMBER'
  const isBiz = user?.role === 'BIZ_REP'

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (isHQ) {
      const u1 = listenMessages(setMessages)
      const u2 = listenBusinesses(setBusinesses)
      return () => { u1(); u2() }
    } else if (isBiz && user.bizId) {
      return listenMessagesByBiz(user.bizId, setMessages)
    }
  }, [user, loading, isHQ, isBiz, router])

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"/>
    </div>
  )

  // ── 본부용 대시보드 ───────────────────────────────────
  if (isHQ) {
    const openMsgs  = messages.filter(m => m.status === 'open')
    const doneMsgs  = messages.filter(m => m.status === 'done')
    const urgentMsgs = messages.filter(m => m.priority === 'urgent' && m.status === 'open')
    const pendingCount = messages.reduce((acc, m) =>
      acc + (m.receipts?.filter(r => r.status === 'pending').length ?? 0), 0)

    // 최근 진행중 메시지 5개
    const recentOpen = openMsgs.slice(0, 5)

    const summaryCards = [
      {
        label: '진행중 전달',
        value: openMsgs.length,
        sub: '답변 대기 중',
        icon: Clock,
        color: 'bg-amber-50 border-amber-200',
        iconColor: 'text-amber-500',
        href: '/businesses',
        badge: openMsgs.length > 0 ? openMsgs.length : null,
      },
      {
        label: '완결 전달',
        value: doneMsgs.length,
        sub: '처리 완료',
        icon: CheckCircle2,
        color: 'bg-green-50 border-green-200',
        iconColor: 'text-green-500',
        href: '/businesses',
        badge: null,
      },
      {
        label: '미접수',
        value: pendingCount,
        sub: '아직 확인 안 함',
        icon: AlertCircle,
        color: pendingCount > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200',
        iconColor: pendingCount > 0 ? 'text-red-500' : 'text-gray-400',
        href: '/businesses',
        badge: null,
      },
      {
        label: '긴급 전달',
        value: urgentMsgs.length,
        sub: '즉시 처리 필요',
        icon: AlertCircle,
        color: urgentMsgs.length > 0 ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200',
        iconColor: urgentMsgs.length > 0 ? 'text-red-600' : 'text-gray-400',
        href: '/businesses',
        badge: null,
      },
      {
        label: '전체 사업장',
        value: businesses.length,
        sub: '등록된 사업장',
        icon: Building2,
        color: 'bg-primary-50 border-primary-200',
        iconColor: 'text-primary-500',
        href: '/businesses',
        badge: null,
      },
    ]

    return (
      <AppShell title="대시보드">
        <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              안녕하세요, {user?.name}님 👋
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">오늘도 좋은 하루 되세요.</p>
          </div>

          {/* 요약 카드 — 클릭하면 페이지 이동 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {summaryCards.map(card => (
              <button key={card.label}
                onClick={() => router.push(card.href)}
                className={clsx(
                  'relative text-left border rounded-xl p-4 hover:shadow-md active:scale-95 transition-all cursor-pointer',
                  card.color
                )}>
                <div className="flex items-start justify-between">
                  <card.icon size={20} className={card.iconColor} />
                  <ChevronRight size={14} className="text-gray-400 mt-0.5" />
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-xs font-medium text-gray-700 mt-0.5">{card.label}</p>
                  <p className="text-xs text-gray-400">{card.sub}</p>
                </div>
                {card.badge && (
                  <span className="absolute top-3 right-3 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {card.badge > 9 ? '9+' : card.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 바로가기 버튼 */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => router.push('/compose')}
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors">
              <Send size={16}/> 전달 작성하기
            </button>
            <button onClick={() => router.push('/businesses')}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              <Building2 size={16}/> 사업장 현황
            </button>
          </div>

          {/* 최근 진행중 전달 */}
          {recentOpen.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">진행중 전달</h3>
                <button onClick={() => router.push('/businesses')}
                  className="text-xs text-primary-600 flex items-center gap-0.5 hover:underline">
                  전체 보기 <ArrowRight size={12}/>
                </button>
              </div>
              <div className="space-y-2">
                {recentOpen.map(msg => {
                  const total    = msg.receipts?.length ?? 0
                  const replied  = msg.receipts?.filter(r => r.status === 'replied').length ?? 0
                  const received = msg.receipts?.filter(r => r.status === 'received').length ?? 0
                  const pending  = total - replied - received

                  return (
                    <button key={msg.id}
                      onClick={() => router.push(`/messages/${msg.id}`)}
                      className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm hover:border-primary-200 transition-all group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {msg.priority === 'urgent' && (
                              <span className="badge-urgent">긴급</span>
                            )}
                            <span className="badge-open">진행중</span>
                          </div>
                          <p className="font-medium text-gray-900 text-sm truncate">{msg.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{msg.authorName}</p>
                        </div>
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400 shrink-0 mt-1"/>
                      </div>
                      {/* 진행 상황 바 */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>답변 현황</span>
                          <span>{replied}/{total}개 완료</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
                          {total > 0 && (
                            <>
                              <div className="bg-green-400 h-full transition-all" style={{ width: `${(replied/total)*100}%` }}/>
                              <div className="bg-blue-400 h-full transition-all" style={{ width: `${(received/total)*100}%` }}/>
                            </>
                          )}
                        </div>
                        <div className="flex gap-3 mt-1.5 text-xs">
                          {replied  > 0 && <span className="text-green-600">✓ 답변 {replied}</span>}
                          {received > 0 && <span className="text-blue-600">● 접수 {received}</span>}
                          {pending  > 0 && <span className="text-gray-400">○ 미접수 {pending}</span>}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </AppShell>
    )
  }

  // ── 사업장 대표 대시보드 ──────────────────────────────
  if (isBiz) {
    const myReceipts = messages.map(m => ({
      msg: m,
      receipt: m.receipts?.find(r => r.bizId === user?.bizId),
    })).filter(({ receipt }) => receipt && !receipt.hidden)

    const openItems = myReceipts.filter(({ msg }) => msg.status === 'open')
    const doneItems = myReceipts.filter(({ msg }) => msg.status === 'done')
    const pendingItems = myReceipts.filter(({ receipt }) => receipt?.status === 'pending')

    return (
      <AppShell title="대시보드">
        <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
          <div>
            <h2 className="text-lg font-bold text-gray-900">안녕하세요, {user?.name}님 👋</h2>
            <p className="text-sm text-gray-500 mt-0.5">오늘도 좋은 하루 되세요.</p>
          </div>

          {/* 요약 카드 - 클릭하면 /dashboard 필터 or 사업장 페이지 */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '전체 전달', value: myReceipts.length, icon: Send, color: 'bg-primary-50 border-primary-200', iconColor: 'text-primary-500' },
              { label: '진행중', value: openItems.length, icon: Clock, color: 'bg-amber-50 border-amber-200', iconColor: 'text-amber-500' },
              { label: '미확인', value: pendingItems.length, icon: AlertCircle,
                color: pendingItems.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200',
                iconColor: pendingItems.length > 0 ? 'text-red-500' : 'text-gray-400' },
            ].map(c => (
              <div key={c.label} className={clsx('border rounded-xl p-3 text-center', c.color)}>
                <c.icon size={18} className={clsx('mx-auto mb-1', c.iconColor)}/>
                <p className="text-xl font-bold text-gray-900">{c.value}</p>
                <p className="text-xs text-gray-600">{c.label}</p>
              </div>
            ))}
          </div>

          {/* 미확인 긴급 전달 */}
          {pendingItems.filter(({ msg }) => msg.priority === 'urgent').length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700 mb-2">🚨 긴급 전달 — 즉시 확인 필요</p>
              {pendingItems.filter(({ msg }) => msg.priority === 'urgent').map(({ msg }) => (
                <button key={msg.id} onClick={() => router.push(`/messages/${msg.id}`)}
                  className="w-full text-left text-sm text-red-800 hover:underline flex items-center gap-1">
                  <ChevronRight size={14}/>{msg.title}
                </button>
              ))}
            </div>
          )}

          {/* 진행중 전달 목록 */}
          <div>
            <h3 className="font-semibold text-gray-900 text-sm mb-3">진행중 전달</h3>
            {openItems.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm bg-white border border-gray-100 rounded-xl">
                현재 진행중인 전달이 없습니다
              </div>
            ) : (
              <div className="space-y-2">
                {openItems.map(({ msg, receipt }) => (
                  <button key={msg.id} onClick={() => router.push(`/messages/${msg.id}`)}
                    className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm hover:border-primary-200 transition-all group">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {msg.priority === 'urgent' && <span className="badge-urgent">긴급</span>}
                          <span className={receipt?.status === 'pending' ? 'badge-pending' :
                            receipt?.status === 'received' ? 'badge-received' : 'badge-replied'}>
                            {receipt?.status === 'pending' ? '미확인' :
                              receipt?.status === 'received' ? '접수확인' : '답변완료'}
                          </span>
                        </div>
                        <p className="font-medium text-sm text-gray-900 truncate">{msg.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{msg.authorName}</p>
                      </div>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400 shrink-0"/>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 완결된 전달 */}
          {doneItems.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-500 text-sm mb-3">완결된 전달</h3>
              <div className="space-y-2 opacity-60">
                {doneItems.slice(0, 3).map(({ msg }) => (
                  <button key={msg.id} onClick={() => router.push(`/messages/${msg.id}`)}
                    className="w-full text-left bg-white border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="badge-done">완결</span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{msg.title}</p>
                      </div>
                      <ChevronRight size={14} className="text-gray-300 shrink-0"/>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </AppShell>
    )
  }

  return null
}
