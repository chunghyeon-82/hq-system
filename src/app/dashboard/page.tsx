'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenMessagesForHQ, listenMessagesForBiz, listenBusinesses } from '@/lib/db'
import type { Message, Business } from '@/types'
import { Send, CheckCircle2, Clock, AlertCircle, Building2, ChevronRight, ArrowRight, MessageSquare, Lock } from 'lucide-react'
import clsx from 'clsx'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [messages,   setMessages]   = useState<Message[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [cardFilter, setCardFilter] = useState<'all' | 'pending' | 'done'>('all')

  const isAdmin = user?.role === 'ADMIN'
  const isHQ    = user?.role === 'ADMIN' || user?.role === 'HQ_CHIEF' || user?.role === 'HQ_MEMBER'
  const isBiz   = user?.role === 'BIZ_REP'
  const canBroadcast = isAdmin || user?.role === 'HQ_CHIEF' || !!user?.permissions?.canBroadcast

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (isHQ) {
      const u1 = listenMessagesForHQ(user.uid, isAdmin, setMessages)
      const u2 = listenBusinesses(setBusinesses)
      return () => { u1(); u2() }
    } else if (isBiz && user.bizId) {
      return listenMessagesForBiz(user.bizId, user.uid, setMessages)
    }
  }, [user, loading, isHQ, isBiz, isAdmin, router])

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"/>
    </div>
  )

  // ── 본부용 ────────────────────────────────────────────
  if (isHQ) {
    const broadcastMsgs = messages.filter(m => m.type === 'broadcast')
    const directMsgs    = messages.filter(m => m.type === 'direct')
    const openMsgs      = broadcastMsgs.filter(m => m.status === 'open')
    const urgentMsgs    = openMsgs.filter(m => m.priority === 'urgent')
    const pendingCount  = broadcastMsgs.reduce((acc, m) =>
      acc + (m.receipts?.filter(r => r.status === 'pending').length ?? 0), 0)
    const unreadDirect  = directMsgs.filter(m => m.status === 'open' && m.targetUid === user?.uid).length

    return (
      <AppShell title="대시보드">
        <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
          <div>
            <h2 className="text-lg font-bold text-gray-900">안녕하세요, {user?.name}님 👋</h2>
            <p className="text-sm text-gray-500 mt-0.5">오늘도 좋은 하루 되세요.</p>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: '진행중 전달',  value: openMsgs.length,           icon: Clock,         color: 'bg-amber-50 border-amber-200',   iconColor: 'text-amber-500',   href: '/businesses' },
              { label: '미접수',       value: pendingCount,              icon: AlertCircle,   color: pendingCount > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200', iconColor: pendingCount > 0 ? 'text-red-500' : 'text-gray-400', href: '/businesses' },
              { label: '긴급 전달',    value: urgentMsgs.length,         icon: AlertCircle,   color: urgentMsgs.length > 0 ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200', iconColor: urgentMsgs.length > 0 ? 'text-red-600' : 'text-gray-400', href: '/businesses' },
              { label: '전체 사업장',  value: businesses.length,         icon: Building2,     color: 'bg-primary-50 border-primary-200', iconColor: 'text-primary-500', href: '/businesses' },
              { label: '1:1 메시지',   value: directMsgs.length,         icon: MessageSquare, color: unreadDirect > 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200', iconColor: unreadDirect > 0 ? 'text-blue-500' : 'text-gray-400', href: '/dashboard' },
            ].map(card => (
              <button key={card.label} onClick={() => router.push(card.href)}
                className={clsx('relative text-left border rounded-xl p-4 hover:shadow-md active:scale-95 transition-all', card.color)}>
                <div className="flex items-start justify-between">
                  <card.icon size={20} className={card.iconColor}/>
                  <ChevronRight size={14} className="text-gray-400 mt-0.5"/>
                </div>
                <div className="mt-2">
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  <p className="text-xs font-medium text-gray-700 mt-0.5">{card.label}</p>
                </div>
              </button>
            ))}
          </div>

          {/* 바로가기 */}
          <div className="flex flex-wrap gap-2">
            {canBroadcast && (
              <button onClick={() => router.push('/compose')}
                className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors">
                <Send size={16}/> 전달 작성
              </button>
            )}
            <button onClick={() => router.push('/businesses')}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              <Building2 size={16}/> 사업장 현황
            </button>
          </div>

          {/* 1:1 메시지 (내게 온 것) */}
          {directMsgs.filter(m => m.targetUid === user?.uid || isAdmin).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lock size={14} className="text-blue-500"/>
                <h3 className="font-semibold text-gray-900 text-sm">1:1 메시지</h3>
                <span className="text-xs text-gray-400">(본인 + 관리자만 열람)</span>
              </div>
              <div className="space-y-2">
                {directMsgs.filter(m => isAdmin || m.targetUid === user?.uid).slice(0, 5).map(msg => (
                  <button key={msg.id} onClick={() => router.push(`/messages/${msg.id}`)}
                    className="w-full text-left bg-white border border-blue-100 rounded-xl p-4 hover:shadow-sm hover:border-blue-200 transition-all group">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="badge-open text-blue-700 bg-blue-50 border-blue-200">1:1</span>
                          {msg.priority === 'urgent' && <span className="badge-urgent">긴급</span>}
                          <span className={msg.status === 'done' ? 'badge-done' : 'badge-open'}>
                            {msg.status === 'done' ? '완결' : '진행중'}
                          </span>
                        </div>
                        <p className="font-medium text-sm text-gray-900 truncate">{msg.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {msg.authorName} → {msg.targetName}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-400 shrink-0"/>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 진행중 broadcast 전달 */}
          {openMsgs.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">진행중 전달</h3>
                <button onClick={() => router.push('/businesses')}
                  className="text-xs text-primary-600 flex items-center gap-0.5 hover:underline">
                  전체 보기 <ArrowRight size={12}/>
                </button>
              </div>
              <div className="space-y-2">
                {openMsgs.slice(0, 5).map(msg => {
                  const total      = msg.receipts?.length ?? 0
                  const doneCount  = msg.receipts?.filter(r => r.status === 'done').length ?? 0
                  const procCount  = msg.receipts?.filter(r => r.status === 'processing').length ?? 0
                  const pendCount  = msg.receipts?.filter(r => r.status === 'pending').length ?? 0
                  return (
                    <button key={msg.id} onClick={() => router.push(`/messages/${msg.id}`)}
                      className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm hover:border-primary-200 transition-all group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {msg.priority === 'urgent' && <span className="badge-urgent">긴급</span>}
                            <span className="badge-open">진행중</span>
                          </div>
                          <p className="font-medium text-gray-900 text-sm truncate">{msg.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{msg.authorName}</p>
                        </div>
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-400 shrink-0 mt-1"/>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>처리 현황</span><span>{doneCount}/{total}개 완료</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
                          <div className="bg-green-400 h-full transition-all" style={{ width: total ? `${(doneCount/total)*100}%` : '0%' }}/>
                          <div className="bg-blue-400 h-full transition-all"  style={{ width: total ? `${(procCount/total)*100}%` : '0%' }}/>
                          <div className="bg-red-300 h-full transition-all"   style={{ width: total ? `${(pendCount/total)*100}%` : '0%' }}/>
                        </div>
                        <div className="flex gap-3 mt-1.5 text-xs">
                          {doneCount > 0 && <span className="text-green-600">✓ 완료 {doneCount}</span>}
                          {procCount > 0 && <span className="text-blue-600">● 처리중 {procCount}</span>}
                          {pendCount > 0 && <span className="text-red-400">○ 미접수 {pendCount}</span>}

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
    const broadcastMsgs = messages.filter(m => m.type === 'broadcast')
    const directMsgs    = messages.filter(m => m.type === 'direct')
    const myReceipts = broadcastMsgs.map(m => ({
      msg: m, receipt: m.receipts?.find(r => r.bizId === user?.bizId)
    })).filter(({ receipt }) => receipt && !receipt.hidden)

    const openItems    = myReceipts.filter(({ msg }) => msg.status === 'open')
    const pendingItems = myReceipts.filter(({ receipt }) => receipt?.status === 'pending')

    const filteredByCard = cardFilter === 'all'
      ? myReceipts
      : cardFilter === 'pending'
      ? myReceipts.filter(({ receipt }) => receipt?.status === 'pending')
      : myReceipts.filter(({ msg }) => msg.status === 'done')

    return (
      <AppShell title="대시보드">
        <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
          <div>
            <h2 className="text-lg font-bold text-gray-900">안녕하세요, {user?.name}님 👋</h2>
            <p className="text-sm text-gray-500 mt-0.5">오늘도 좋은 하루 되세요.</p>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '전달받은 건수', value: myReceipts.length,    icon: Send,        color: 'bg-primary-50 border-primary-200', iconColor: 'text-primary-500', filter: 'all' },
              { label: '미접수',        value: pendingItems.length,  icon: AlertCircle,
                color: pendingItems.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200',
                iconColor: pendingItems.length > 0 ? 'text-red-500' : 'text-gray-400', filter: 'pending' },
              { label: '처리 완료',     value: myReceipts.filter(({msg}) => msg.status === 'done').length, icon: CheckCircle2, color: 'bg-green-50 border-green-200', iconColor: 'text-green-500', filter: 'done' },
            ].map(c => (
              <button key={c.label}
                onClick={() => setCardFilter(c.filter as 'all' | 'pending' | 'done')}
                className={clsx('border rounded-xl p-3 text-center hover:shadow-md active:scale-95 transition-all cursor-pointer', c.color,
                  cardFilter === c.filter ? 'ring-2 ring-primary-400' : ''
                )}>
                <c.icon size={18} className={clsx('mx-auto mb-1', c.iconColor)}/>
                <p className="text-xl font-bold text-gray-900">{c.value}</p>
                <p className="text-xs text-gray-600">{c.label}</p>
              </button>
            ))}
          </div>

          {/* 1:1 메시지 바로가기 */}
          <button onClick={() => router.push('/direct')}
            className="w-full flex items-center gap-3 bg-white border border-blue-200 rounded-xl p-4 hover:shadow-sm hover:border-blue-300 transition-all">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <MessageSquare size={18} className="text-blue-500"/>
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-sm text-gray-900">담당자에게 1:1 메시지</p>
              <p className="text-xs text-gray-400 mt-0.5">본부 담당자에게 직접 문의할 수 있습니다</p>
            </div>
            <ChevronRight size={16} className="text-gray-300"/>
          </button>

          {/* 내가 보낸 1:1 메시지 */}
          {directMsgs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lock size={13} className="text-blue-400"/>
                <h3 className="font-semibold text-gray-900 text-sm">내 1:1 메시지</h3>
              </div>
              <div className="space-y-2">
                {directMsgs.slice(0, 3).map(msg => (
                  <button key={msg.id} onClick={() => router.push(`/messages/${msg.id}`)}
                    className="w-full text-left bg-white border border-blue-100 rounded-xl p-3 hover:shadow-sm transition-all group">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={msg.status === 'done' ? 'badge-done' : 'badge-open'}>
                            {msg.status === 'done' ? '완결' : '진행중'}
                          </span>
                          {msg.priority === 'urgent' && <span className="badge-urgent">긴급</span>}
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">{msg.title}</p>
                        <p className="text-xs text-gray-400">→ {msg.targetName}</p>
                      </div>
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-400 shrink-0"/>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 전달 목록 (카드 필터 연동) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">
                {cardFilter === 'all' ? '전체 전달' : cardFilter === 'pending' ? '미확인 전달' : '처리 완료'}
              </h3>
              {cardFilter !== 'all' && (
                <button onClick={() => setCardFilter('all')}
                  className="text-xs text-primary-600 hover:underline">전체 보기</button>
              )}
            </div>
            {filteredByCard.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm bg-white border border-gray-100 rounded-xl">
                {cardFilter === 'pending' ? '미확인 전달이 없습니다 👍' :
                 cardFilter === 'done'    ? '처리 완료된 전달이 없습니다' :
                                           '전달 내역이 없습니다'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredByCard.map(({ msg, receipt }) => (
                  <button key={msg.id} onClick={() => router.push(`/messages/${msg.id}`)}
                    className={clsx(
                      'w-full text-left border rounded-xl p-4 hover:shadow-sm transition-all group',
                      msg.status === 'done'
                        ? 'bg-gray-50 border-gray-200 opacity-75'
                        : 'bg-white border-gray-200 hover:border-primary-200'
                    )}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {msg.priority === 'urgent' && <span className="badge-urgent">긴급</span>}
                          <span className={msg.status === 'done' ? 'badge-done' :
                            receipt?.status === 'pending'  ? 'badge-pending' :
                            receipt?.status === 'processing' ? 'badge-received' : 'badge-replied'}>
                            {msg.status === 'done'            ? '처리완료'  :
                             receipt?.status === 'pending'    ? '미접수'    :
                             receipt?.status === 'processing' ? '처리중'  : '답변완료'}
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
        </div>
      </AppShell>
    )
  }

  return null
}
