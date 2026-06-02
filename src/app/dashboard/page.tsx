'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenMessagesForHQ, listenMessagesForBiz, listenBusinesses, listenEvents } from '@/lib/db'
import type { Message, Business, CalendarEvent } from '@/types'
import { Send, CheckCircle2, AlertCircle, ChevronRight, MessageSquare, Lock, Calendar, Inbox, ArrowUpRight } from 'lucide-react'
import clsx from 'clsx'

const CATEGORY_LABEL: Record<string, string> = {
  instruction: '업무지시', confirm: '확인요청', notice: '단순공지'
}

// 이번 주 월~일 범위
function getThisWeek() {
  const today = new Date()
  const dow   = today.getDay()
  const sun   = new Date(today); sun.setDate(today.getDate() - dow)
  const sat   = new Date(sun);   sat.setDate(sun.getDate() + 6)
  return {
    sun, sat,
    todayStr: today.toISOString().slice(0, 10),
    sunStr:   sun.toISOString().slice(0, 10),
    satStr:   sat.toISOString().slice(0, 10),
    days: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sun); d.setDate(sun.getDate() + i)
      return d
    })
  }
}

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [messages,   setMessages]   = useState<Message[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [events,     setEvents]     = useState<CalendarEvent[]>([])
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
      const u3 = listenEvents(user.uid, user.bizId, setEvents)
      return () => { u1(); u2(); u3() }
    } else if (isBiz && user.bizId) {
      const u1 = listenMessagesForBiz(user.bizId, user.uid, setMessages)
      const u2 = listenEvents(user.uid, user.bizId, setEvents)
      return () => { u1(); u2() }
    }
  }, [user, loading, isHQ, isBiz, isAdmin, router])

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"/>
    </div>
  )

  // ── 이번 주 일정 공통 컴포넌트 ────────────────────────
  const WeekCalendar = () => {
    const { days, todayStr, sunStr, satStr } = getThisWeek()
    const weekEvents = events
      .filter(e => e.date >= sunStr && e.date <= satStr && !e.isDone)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return (a.time ?? '99:99').localeCompare(b.time ?? '99:99')
      })
    const DOW_KO = ['일','월','화','수','목','금','토']
    return (
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-primary-500"/>
            <h3 className="font-semibold text-gray-900 text-sm">이번 주 일정</h3>
          </div>
          <button onClick={() => router.push('/calendar')}
            className="text-xs text-primary-600 hover:underline flex items-center gap-0.5">
            전체 보기 <ArrowUpRight size={11}/>
          </button>
        </div>
        {weekEvents.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {weekEvents.slice(0, 5).map(e => {
              const d = new Date(e.date + 'T00:00:00')
              const dow = DOW_KO[d.getDay()]
              const isToday = e.date === todayStr
              return (
                <button key={e.id} onClick={() => router.push('/calendar')}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className={clsx('w-10 text-center shrink-0', isToday ? 'text-primary-600' : 'text-gray-400')}>
                    <div className="text-xs font-medium">{dow}</div>
                    <div className={clsx('text-lg font-bold leading-tight',
                      isToday ? 'text-primary-600' : 'text-gray-700')}>{d.getDate()}</div>
                  </div>
                  <div className={clsx('w-0.5 h-8 rounded-full shrink-0',
                    isToday ? 'bg-primary-400' : 'bg-gray-200')}/>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={clsx('text-sm font-medium truncate',
                      isToday ? 'text-primary-800' : 'text-gray-900')}>{e.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {e.time ? e.time : '종일'}
                      {(e as CalendarEvent & {location?:string}).location
                        ? ` · ${(e as CalendarEvent & {location?:string}).location}` : ''}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-center text-xs text-gray-400 py-6">이번 주 일정이 없습니다</p>
        )}
      </div>
    )
  }


  // ── 본부용 대시보드 ────────────────────────────────────
  if (isHQ) {
    const broadcastMsgs = messages.filter(m => m.type === 'broadcast')
    const directMsgs    = messages.filter(m => m.type === 'direct')

    // 전달사항 집계
    const pendingMsgs = broadcastMsgs.filter(m =>
      m.targetBizIds?.length > 0 && m.status === 'open' &&
      m.receipts?.some(r => r.status === 'pending')
    )
    const processingMsgs = broadcastMsgs.filter(m =>
      m.targetBizIds?.length > 0 && m.status === 'open' &&
      !m.receipts?.some(r => r.status === 'pending') &&
      m.receipts?.some(r => r.status === 'processing')
    )
    const doneMsgs = broadcastMsgs.filter(m => m.status === 'done')

    // 메시지
    const receivedMsgs = directMsgs.filter(m =>
      (m.targetUid === user?.uid || isAdmin) &&
      m.authorUid !== user?.uid
    )
    const sentMsgs = directMsgs.filter(m =>
      m.authorUid === user?.uid
    )

    return (
      <AppShell title="대시보드">
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">안녕하세요, {user?.name}님 👋</h2>
            <p className="text-sm text-gray-500 mt-0.5">오늘도 좋은 하루 되세요.</p>
          </div>

          {/* ── 전달사항 ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">전달사항</h3>
              {canBroadcast && (
                <button onClick={() => router.push('/compose')}
                  className="flex items-center gap-1.5 bg-primary-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-primary-800 transition-colors">
                  <Send size={12}/> 전달 작성
                </button>
              )}
            </div>
            {/* 집계 카드 */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[
                { label: '미접수', value: pendingMsgs.reduce((a, m) => a + (m.receipts?.filter(r => r.status === 'pending').length ?? 0), 0), color: 'text-red-500',   bg: 'bg-red-50 border-red-100' },
                { label: '진행중', value: processingMsgs.length, color: 'text-blue-500',  bg: 'bg-blue-50 border-blue-100' },
                { label: '완료',   value: doneMsgs.length,       color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
              ].map(s => (
                <button key={s.label} onClick={() => router.push('/businesses')}
                  className={clsx('border rounded-xl p-3 text-center hover:shadow-sm transition-all', s.bg)}>
                  <p className={clsx('text-2xl font-bold', s.color)}>{s.value}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
                </button>
              ))}
            </div>
            {/* 미접수 목록 */}
            {pendingMsgs.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-600">📥 미접수 전달</span>
                  <button onClick={() => router.push('/businesses')}
                    className="text-xs text-red-500 hover:underline">전체 보기</button>
                </div>
                {pendingMsgs.slice(0, 3).map(msg => {
                  const pendCount = msg.receipts?.filter(r => r.status === 'pending').length ?? 0
                  return (
                    <button key={msg.id} onClick={() => router.push(`/messages/${msg.id}`)}
                      className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
                          {CATEGORY_LABEL[msg.category ?? 'instruction']}
                        </span>
                        <span className="text-sm font-medium text-gray-900 flex-1 truncate">{msg.title}</span>
                        <span className="text-xs text-red-500 shrink-0">{pendCount}곳 미접수</span>
                        <ChevronRight size={14} className="text-gray-300 shrink-0"/>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── 메시지 ── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">메시지</h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {/* 받은 메시지 */}
              <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                <Inbox size={13} className="text-blue-500"/>
                <span className="text-xs font-semibold text-blue-600">받은 메시지 {receivedMsgs.length}건</span>
              </div>
              {receivedMsgs.length === 0 ? (
                <p className="text-xs text-gray-400 px-4 py-3">받은 메시지가 없습니다</p>
              ) : receivedMsgs.slice(0, 3).map(msg => (
                <button key={msg.id} onClick={() => router.push(`/messages/${msg.id}`)}
                  className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors flex items-center gap-2">
                  <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                    msg.status === 'done' ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700')}>
                    {msg.status === 'done' ? '완결' : '진행중'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{msg.title}</p>
                    <p className="text-xs text-gray-400">{msg.authorName} → 나</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 shrink-0"/>
                </button>
              ))}
              {/* 보낸 메시지 */}
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 border-b border-gray-100 flex items-center gap-2">
                <ArrowUpRight size={13} className="text-gray-400"/>
                <span className="text-xs font-semibold text-gray-500">보낸 메시지 {sentMsgs.length}건</span>
              </div>
              {sentMsgs.length === 0 ? (
                <p className="text-xs text-gray-400 px-4 py-3">보낸 메시지가 없습니다</p>
              ) : sentMsgs.slice(0, 3).map(msg => (
                <button key={msg.id} onClick={() => router.push(`/messages/${msg.id}`)}
                  className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors flex items-center gap-2">
                  <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                    msg.status === 'done' ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700')}>
                    {msg.status === 'done' ? '완결' : '진행중'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{msg.title}</p>
                    <p className="text-xs text-gray-400">나 → {msg.targetName}</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 shrink-0"/>
                </button>
              ))}
            </div>
          </div>

          {/* ── 이번 주 일정 ── */}
          <WeekCalendar/>
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
    })).filter(({ receipt, msg }) => receipt && !receipt.hidden && msg.targetBizIds?.length > 0)

    const pendingItems    = myReceipts.filter(({ receipt }) => receipt?.status === 'pending')
    const processingItems = myReceipts.filter(({ receipt }) => receipt?.status === 'processing')
    const doneItems       = myReceipts.filter(({ msg }) => msg.status === 'done')

    const receivedDirect = directMsgs.filter(m => m.targetUid === user?.uid)
    const sentDirect     = directMsgs.filter(m => m.authorUid === user?.uid)

    const filteredByCard = cardFilter === 'all'
      ? myReceipts
      : cardFilter === 'pending'
      ? pendingItems
      : doneItems

    return (
      <AppShell title="대시보드">
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">안녕하세요, {user?.name}님 👋</h2>
            <p className="text-sm text-gray-500 mt-0.5">오늘도 좋은 하루 되세요.</p>
          </div>

          {/* ── 전달사항 ── */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">전달사항</h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[
                { label: '미접수',  value: pendingItems.length,    color: 'text-red-500',   bg: pendingItems.length > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100',   filter: 'pending' },
                { label: '진행중',  value: processingItems.length, color: 'text-blue-500',  bg: 'bg-blue-50 border-blue-100',   filter: 'all' },
                { label: '완료',    value: doneItems.length,       color: 'text-green-600', bg: 'bg-green-50 border-green-100', filter: 'done' },
              ].map(s => (
                <button key={s.label}
                  onClick={() => setCardFilter(s.filter as 'all' | 'pending' | 'done')}
                  className={clsx('border rounded-xl p-3 text-center hover:shadow-sm transition-all', s.bg,
                    cardFilter === s.filter ? 'ring-2 ring-primary-400' : '')}>
                  <p className={clsx('text-2xl font-bold', s.color)}>{s.value}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{s.label}</p>
                </button>
              ))}
            </div>
            {/* 전달 목록 */}
            {filteredByCard.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm bg-white border border-gray-100 rounded-xl">
                {cardFilter === 'pending' ? '미접수 전달이 없습니다 👍' :
                 cardFilter === 'done'    ? '처리 완료된 전달이 없습니다' : '전달 내역이 없습니다'}
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                {filteredByCard.slice(0, 5).map(({ msg, receipt }) => (
                  <button key={msg.id} onClick={() => router.push(`/messages/${msg.id}`)}
                    className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors flex items-center gap-2">
                    <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                      msg.status === 'done'              ? 'bg-gray-100 text-gray-500' :
                      receipt?.status === 'pending'      ? 'bg-red-100 text-red-700' :
                      receipt?.status === 'processing'   ? 'bg-blue-100 text-blue-700' :
                                                           'bg-green-100 text-green-700')}>
                      {msg.status === 'done'            ? '처리완료' :
                       receipt?.status === 'pending'    ? '미접수'   :
                       receipt?.status === 'processing' ? '처리중'   : '답변완료'}
                    </span>
                    {msg.priority === 'urgent' && (
                      <AlertCircle size={13} className="text-red-500 shrink-0"/>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{msg.title}</p>
                      <p className="text-xs text-gray-400">{msg.authorName}</p>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 shrink-0"/>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── 메시지 ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">메시지</h3>
              <button onClick={() => router.push('/direct')}
                className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
                <MessageSquare size={11}/> 새 메시지
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {/* 받은 메시지 */}
              <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                <Inbox size={13} className="text-blue-500"/>
                <span className="text-xs font-semibold text-blue-600">받은 메시지 {receivedDirect.length}건</span>
              </div>
              {receivedDirect.length === 0 ? (
                <p className="text-xs text-gray-400 px-4 py-3">받은 메시지가 없습니다</p>
              ) : receivedDirect.slice(0, 3).map(msg => (
                <button key={msg.id} onClick={() => router.push(`/messages/${msg.id}`)}
                  className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors flex items-center gap-2">
                  <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                    msg.status === 'done' ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700')}>
                    {msg.status === 'done' ? '완결' : '진행중'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{msg.title}</p>
                    <p className="text-xs text-gray-400">{msg.authorName} → 나</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 shrink-0"/>
                </button>
              ))}
              {/* 보낸 메시지 */}
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 border-b border-gray-100 flex items-center gap-2">
                <ArrowUpRight size={13} className="text-gray-400"/>
                <span className="text-xs font-semibold text-gray-500">보낸 메시지 {sentDirect.length}건</span>
              </div>
              {sentDirect.length === 0 ? (
                <p className="text-xs text-gray-400 px-4 py-3">보낸 메시지가 없습니다</p>
              ) : sentDirect.slice(0, 3).map(msg => (
                <button key={msg.id} onClick={() => router.push(`/messages/${msg.id}`)}
                  className="w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors flex items-center gap-2">
                  <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
                    msg.status === 'done' ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700')}>
                    {msg.status === 'done' ? '완결' : '진행중'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{msg.title}</p>
                    <p className="text-xs text-gray-400">나 → {msg.targetName}</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 shrink-0"/>
                </button>
              ))}
            </div>
          </div>

          {/* ── 이번 주 일정 ── */}
          <WeekCalendar/>
        </div>
      </AppShell>
    )
  }

  return null
}
