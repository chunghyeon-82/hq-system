'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import {
  listenEvents, addEvent, updateEvent, deleteEvent,
  listenPendingSharedEvents, acceptSharedEvent, declineSharedEvent,
  shareEvent, listenUsers
} from '@/lib/db'
import type { CalendarEvent, AppUser } from '@/types'
import {
  Star, Plus, Trash2, CheckCircle2, Circle, Bell,
  X, ChevronLeft, ChevronRight, MapPin, Clock,
  Share2, Users
} from 'lucide-react'
import clsx from 'clsx'

const DOW = ['일','월','화','수','목','금','토']
const REMINDER_OPTIONS = [
  { value: 10,  unit: 'minutes' as const, label: '10분 전' },
  { value: 30,  unit: 'minutes' as const, label: '30분 전' },
  { value: 1,   unit: 'hours'   as const, label: '1시간 전' },
  { value: 3,   unit: 'hours'   as const, label: '3시간 전' },
  { value: 1,   unit: 'days'    as const, label: '1일 전' },
]

export default function CalendarPage() {
  const { user } = useAuth()
  const router   = useRouter()

  const [events,   setEvents]   = useState<CalendarEvent[]>([])
  const [pending,  setPending]  = useState<CalendarEvent[]>([])
  const [allUsers, setAllUsers] = useState<AppUser[]>([])

  // 달력 상태
  const today = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  // 일정 등록 모달
  const [modal,       setModal]       = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [editEvent,   setEditEvent]   = useState<CalendarEvent | null>(null)

  // 폼 필드
  const [title,       setTitle]       = useState('')
  const [memo,        setMemo]        = useState('')
  const [location,    setLocation]    = useState('')
  const [timeHour,    setTimeHour]    = useState('09')
  const [timeMin,     setTimeMin]     = useState('00')
  const [timeAmPm,    setTimeAmPm]    = useState<'AM'|'PM'>('AM')
  const [hasTime,     setHasTime]     = useState(false)
  const [isImportant, setIsImportant] = useState(false)
  const [isShared,    setIsShared]    = useState(false)
  const [sharedUids,  setSharedUids]  = useState<string[]>([])
  const [reminder,    setReminder]    = useState<string>('')
  const [saving,      setSaving]      = useState(false)

  // 드래그
  const dragId = useRef<string | null>(null)

  const isHQ = user?.role === 'ADMIN' || user?.role === 'HQ_CHIEF' || user?.role === 'HQ_MEMBER'

  useEffect(() => {
    if (!user) { router.replace('/login'); return }
    const u1 = listenEvents(user.uid, user.bizId, setEvents)
    const u2 = listenPendingSharedEvents(user.uid, setPending)
    const u3 = listenUsers(setAllUsers)
    return () => { u1(); u2(); u3() }
  }, [user, router])

  // ── 달력 계산 ───────────────────────────────────────
  const firstDay  = new Date(viewYear, viewMonth, 1).getDay()
  const lastDate  = new Date(viewYear, viewMonth + 1, 0).getDate()
  const todayStr  = today.toISOString().slice(0, 10)

  const getDateStr = (d: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`

  const eventsOnDate = (dStr: string) =>
    events.filter(e => e.date === dStr && !e.isDone)

  // 주요일정
  const importantEvents = events
    .filter(e => e.isImportant && !e.isDone && e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  // ── 폼 초기화 ───────────────────────────────────────
  const openAddModal = (dateStr: string) => {
    setSelectedDate(dateStr)
    setEditEvent(null)
    setTitle(''); setMemo(''); setLocation('')
    setTimeHour('09'); setTimeMin('00'); setTimeAmPm('AM')
    setHasTime(false); setIsImportant(false); setIsShared(false)
    setSharedUids([]); setReminder('')
    setModal(true)
  }

  const openEditModal = (e: CalendarEvent) => {
    setSelectedDate(e.date)
    setEditEvent(e)
    setTitle(e.title); setMemo(e.memo ?? ''); setLocation(e.location ?? '')
    setIsImportant(!!e.isImportant); setIsShared(!!e.sharedWith?.length)
    setSharedUids(e.sharedWith ?? [])
    if (e.time) {
      const [h, m] = e.time.split(':').map(Number)
      setTimeAmPm(h >= 12 ? 'PM' : 'AM')
      setTimeHour(String(h > 12 ? h - 12 : h === 0 ? 12 : h).padStart(2,'0'))
      setTimeMin(String(m).padStart(2,'0'))
      setHasTime(true)
    } else {
      setHasTime(false)
    }
    setModal(true)
  }

  const getTime24 = () => {
    const h = parseInt(timeHour)
    const hour24 = timeAmPm === 'AM'
      ? (h === 12 ? 0 : h)
      : (h === 12 ? 12 : h + 12)
    return `${String(hour24).padStart(2,'0')}:${timeMin}`
  }

  const handleSave = async () => {
    if (!user || !title.trim()) return
    setSaving(true)
    const data = {
      title: title.trim(),
      date:  selectedDate,
      time:  hasTime ? getTime24() : undefined,
      memo:  memo.trim() || undefined,
      location: location.trim() || undefined,
      isImportant,
      ownerUid:  user.uid,
      ownerName: user.name,
      isDone: false,
      ...(reminder ? {
        reminder: {
          value: parseInt(reminder.split(':')[0]),
          unit:  reminder.split(':')[1] as 'minutes'|'hours'|'days'
        }
      } : {}),
    }

    let eventId: string
    if (editEvent) {
      await updateEvent(editEvent.id, data)
      eventId = editEvent.id
    } else {
      const ref = await addEvent(data)
      eventId = ref.id
    }

    // 공유 처리
    if (isShared && sharedUids.length > 0) {
      await shareEvent(eventId, sharedUids, [])
      // 공유 대상에게 푸시
      setTimeout(() => {
        fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer hq-cleanup-2026' },
          body: JSON.stringify({
            title: '📅 일정이 공유됐습니다',
            body:  `${user.name}님이 "${title.trim()}" 일정을 공유했습니다`,
            url:   '/calendar',
            targetUids: sharedUids,
          }),
        }).catch(() => {})
      }, 0)
    }

    setSaving(false)
    setModal(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('일정을 삭제하시겠습니까?')) return
    await deleteEvent(id)
  }

  const handleDrop = async (dateStr: string) => {
    if (!dragId.current) return
    const ev = events.find(e => e.id === dragId.current)
    if (!ev || ev.date === dateStr) { dragId.current = null; return }
    await updateEvent(ev.id, { date: dateStr })
    dragId.current = null
  }

  const toggleDone = async (e: CalendarEvent) => {
    await updateEvent(e.id, {
      isDone: !e.isDone,
      doneAt: !e.isDone ? new Date().toISOString() : undefined
    })
  }

  const toggleShareUser = (uid: string) => {
    setSharedUids(prev =>
      prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]
    )
  }

  const formatDateKo = (dStr: string) => {
    const d = new Date(dStr + 'T00:00:00')
    return d.toLocaleDateString('ko-KR', { month:'long', day:'numeric', weekday:'short' })
  }

  const shareTargets = allUsers.filter(u => u.uid !== user?.uid)

  return (
    <AppShell title="캘린더">
      <div className="max-w-4xl mx-auto p-4 space-y-4">

        {/* 삭제 정책 안내 */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-400">
          <span>🗑</span>
          <span>완료된 일정은 <strong className="text-gray-500">1개월 후</strong> 자동 삭제됩니다</span>
        </div>

        {/* 공유 대기 팝업 */}
        {pending.length > 0 && (
          <div className="space-y-2">
            {pending.map(e => (
              <div key={e.id} className="bg-primary-50 border border-primary-200 rounded-xl p-4">
                <p className="text-sm font-medium text-primary-900 mb-1">
                  📅 {e.ownerName}님이 일정을 공유했습니다
                </p>
                <p className="text-sm text-primary-700 mb-3">
                  "{e.title}" — {formatDateKo(e.date)}{e.time ? ` ${e.time}` : ''}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => acceptSharedEvent(e.id, user!.uid)}
                    className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-800">
                    캘린더에 추가
                  </button>
                  <button onClick={() => declineSharedEvent(e.id, user!.uid)}
                    className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                    거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 주요일정 */}
        {importantEvents.length > 0 && (
          <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
              <Star size={14} className="text-amber-500"/>
              <span className="text-xs font-semibold text-amber-700">주요 일정</span>
            </div>
            <div className="divide-y divide-gray-50">
              {importantEvents.map(e => (
                <button key={e.id} onClick={() => openEditModal(e)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
                    <p className="text-xs text-gray-400">
                      {formatDateKo(e.date)}{e.time ? ` ${e.time}` : ''}
                      {e.location ? ` · ${e.location}` : ''}
                    </p>
                  </div>
                  {e.sharedWith?.length ? (
                    <Share2 size={12} className="text-primary-400 shrink-0"/>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 월간 달력 */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* 헤더 */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => { setViewMonth(m => { if (m === 0) { setViewYear(y => y-1); return 11 } return m-1 }) }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <ChevronLeft size={16}/>
              </button>
              <h3 className="font-semibold text-gray-900">{viewYear}년 {viewMonth+1}월</h3>
              <button onClick={() => { setViewMonth(m => { if (m === 11) { setViewYear(y => y+1); return 0 } return m+1 }) }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <ChevronRight size={16}/>
              </button>
            </div>
            <button onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()) }}
              className="text-xs text-primary-600 border border-primary-200 px-2.5 py-1 rounded-lg hover:bg-primary-50">
              오늘
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DOW.map((d, i) => (
              <div key={d} className={clsx('text-center py-2 text-xs font-medium',
                i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400')}>
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7">
            {/* 빈 칸 */}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] border-r border-b border-gray-50"/>
            ))}
            {/* 날짜 */}
            {Array.from({ length: lastDate }, (_, i) => {
              const d    = i + 1
              const dStr = getDateStr(d)
              const isToday   = dStr === todayStr
              const dow       = (firstDay + i) % 7
              const dayEvents = eventsOnDate(dStr)

              return (
                <div key={d}
                  className={clsx(
                    'min-h-[80px] border-r border-b border-gray-50 p-1 cursor-pointer hover:bg-gray-50 transition-colors',
                    isToday ? 'bg-primary-50/50' : ''
                  )}
                  onClick={() => openAddModal(dStr)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDrop(dStr)}
                >
                  {/* 날짜 숫자 */}
                  <div className={clsx(
                    'w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full mb-1',
                    isToday ? 'bg-primary-600 text-white' :
                    dow === 0 ? 'text-red-400' :
                    dow === 6 ? 'text-blue-400' : 'text-gray-700'
                  )}>
                    {d}
                  </div>
                  {/* 일정 목록 */}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => (
                      <div key={ev.id}
                        className={clsx(
                          'text-xs px-1.5 py-0.5 rounded truncate cursor-grab',
                          ev.isImportant ? 'bg-amber-100 text-amber-800' : 'bg-primary-100 text-primary-800'
                        )}
                        draggable
                        onDragStart={e => { e.stopPropagation(); dragId.current = ev.id }}
                        onClick={e => { e.stopPropagation(); openEditModal(ev) }}
                      >
                        {ev.time ? `${ev.time} ` : ''}{ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-gray-400 px-1">+{dayEvents.length - 3}개</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 완료된 일정 */}
        {events.filter(e => e.isDone).length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-gray-400 mb-2">완료된 일정</h3>
            <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
              {events.filter(e => e.isDone).slice(0, 5).map(e => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 opacity-50">
                  <button onClick={() => toggleDone(e)}>
                    <CheckCircle2 size={16} className="text-green-400"/>
                  </button>
                  <span className="text-sm text-gray-500 line-through flex-1 truncate">{e.title}</span>
                  <span className="text-xs text-gray-400">{formatDateKo(e.date)}</span>
                  <button onClick={() => handleDelete(e.id)} className="text-gray-200 hover:text-red-400">
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 일정 등록/편집 모달 ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="font-semibold text-gray-900">
                {editEvent ? '일정 수정' : `일정 추가 — ${formatDateKo(selectedDate)}`}
              </h3>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20}/>
              </button>
            </div>
            <div className="p-5 space-y-4">

              {/* 제목 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">제목 *</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="일정 제목"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              </div>

              {/* 시간 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-gray-400"/>
                  <label className="text-sm font-medium text-gray-700">시간</label>
                  <button onClick={() => setHasTime(v => !v)}
                    className={clsx('ml-auto text-xs px-2.5 py-1 rounded-lg border transition-colors',
                      hasTime ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500')}>
                    {hasTime ? '시간 있음' : '종일'}
                  </button>
                </div>
                {hasTime && (
                  <div className="flex gap-2">
                    <button onClick={() => setTimeAmPm('AM')}
                      className={clsx('px-3 py-2 rounded-lg text-sm border font-medium transition-colors',
                        timeAmPm==='AM' ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600')}>
                      오전
                    </button>
                    <button onClick={() => setTimeAmPm('PM')}
                      className={clsx('px-3 py-2 rounded-lg text-sm border font-medium transition-colors',
                        timeAmPm==='PM' ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600')}>
                      오후
                    </button>
                    <select value={timeHour} onChange={e => setTimeHour(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                      {Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')).map(h=>(
                        <option key={h} value={h}>{h}시</option>
                      ))}
                    </select>
                    <select value={timeMin} onChange={e => setTimeMin(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
                      {['00','10','20','30','40','50'].map(m=>(
                        <option key={m} value={m}>{m}분</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* 장소 */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <MapPin size={14} className="text-gray-400"/>
                  <label className="text-sm font-medium text-gray-700">장소</label>
                </div>
                <input value={location} onChange={e => setLocation(e.target.value)}
                  placeholder="장소 입력 (선택)"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              </div>

              {/* 내용 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">내용</label>
                <textarea value={memo} onChange={e => setMemo(e.target.value)}
                  placeholder="메모 (선택)" rows={3}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
              </div>

              {/* 알림 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Bell size={14} className="text-gray-400"/>
                  <label className="text-sm font-medium text-gray-700">알림</label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setReminder('')}
                    className={clsx('px-3 py-1.5 rounded-lg text-xs border transition-colors',
                      !reminder ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500')}>
                    없음
                  </button>
                  {REMINDER_OPTIONS.map(opt => (
                    <button key={opt.label}
                      onClick={() => setReminder(`${opt.value}:${opt.unit}`)}
                      className={clsx('px-3 py-1.5 rounded-lg text-xs border transition-colors',
                        reminder === `${opt.value}:${opt.unit}`
                          ? 'bg-primary-50 border-primary-300 text-primary-700'
                          : 'border-gray-200 text-gray-500')}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 주요일정 */}
              <button onClick={() => setIsImportant(v => !v)}
                className={clsx('w-full flex items-center gap-3 px-4 py-3 border rounded-xl transition-colors',
                  isImportant ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200')}>
                <Star size={16} className={isImportant ? 'text-amber-500' : 'text-gray-400'}/>
                <div className="flex-1 text-left">
                  <p className={clsx('text-sm font-medium', isImportant ? 'text-amber-800' : 'text-gray-700')}>주요일정으로 등록</p>
                  <p className="text-xs text-gray-400">캘린더 상단에 항상 표시됩니다</p>
                </div>
                <div className={clsx('w-5 h-5 rounded-full border-2 flex items-center justify-center',
                  isImportant ? 'border-amber-500 bg-amber-500' : 'border-gray-300')}>
                  {isImportant && <span className="text-white text-xs">✓</span>}
                </div>
              </button>

              {/* 일정 공유 */}
              <div>
                <button onClick={() => setIsShared(v => !v)}
                  className={clsx('w-full flex items-center gap-3 px-4 py-3 border rounded-xl transition-colors',
                    isShared ? 'bg-primary-50 border-primary-300' : 'bg-white border-gray-200')}>
                  <Share2 size={16} className={isShared ? 'text-primary-500' : 'text-gray-400'}/>
                  <div className="flex-1 text-left">
                    <p className={clsx('text-sm font-medium', isShared ? 'text-primary-800' : 'text-gray-700')}>일정 공유</p>
                    <p className="text-xs text-gray-400">팀원/대표 캘린더에 공유합니다</p>
                  </div>
                  <div className={clsx('w-5 h-5 rounded-full border-2 flex items-center justify-center',
                    isShared ? 'border-primary-500 bg-primary-500' : 'border-gray-300')}>
                    {isShared && <span className="text-white text-xs">✓</span>}
                  </div>
                </button>

                {/* 공유 대상 선택 */}
                {isShared && (
                  <div className="mt-2 border border-primary-100 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-primary-50 border-b border-primary-100 flex items-center gap-2">
                      <Users size={13} className="text-primary-500"/>
                      <span className="text-xs font-medium text-primary-700">공유 대상 선택</span>
                    </div>
                    {shareTargets.map(u => (
                      <button key={u.uid} onClick={() => toggleShareUser(u.uid)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                        <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                          {u.name?.[0]}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-gray-800">{u.name}</p>
                          <p className="text-xs text-gray-400">
                            {{ADMIN:'관리자',HQ_CHIEF:'본부장',HQ_MEMBER:'본부멤버',BIZ_REP:'사업장대표',ETC:'기타'}[u.role] ?? u.role}
                          </p>
                        </div>
                        <div className={clsx('w-5 h-5 rounded border-2 flex items-center justify-center',
                          sharedUids.includes(u.uid) ? 'border-primary-500 bg-primary-500' : 'border-gray-300')}>
                          {sharedUids.includes(u.uid) && <span className="text-white text-xs">✓</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 저장/삭제 버튼 */}
              <div className="flex gap-2 pt-2">
                {editEvent && (
                  <button onClick={() => { handleDelete(editEvent.id); setModal(false) }}
                    className="flex items-center gap-2 border border-red-200 text-red-500 px-4 py-3 rounded-xl text-sm hover:bg-red-50">
                    <Trash2 size={14}/> 삭제
                  </button>
                )}
                {editEvent && (
                  <button onClick={() => { toggleDone(editEvent); setModal(false) }}
                    className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-3 rounded-xl text-sm hover:bg-gray-50">
                    <CheckCircle2 size={14}/> {editEvent.isDone ? '미완료로' : '완료'}
                  </button>
                )}
                <button onClick={handleSave} disabled={!title.trim() || saving}
                  className="flex-1 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
                  {saving ? '저장 중...' : editEvent ? '수정 완료' : '일정 저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
