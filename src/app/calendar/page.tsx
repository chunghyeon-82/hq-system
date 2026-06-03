'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { getLunarDate, fetchHolidays, getHolidayName, type Holiday } from '@/lib/calendar-utils'
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
  Star, Trash2, CheckCircle2, Bell, X,
  ChevronLeft, ChevronRight, MapPin, Clock, Share2, Users
} from 'lucide-react'
import clsx from 'clsx'

const DOW = ['일','월','화','수','목','금','토']

const COLORS = [
  { value: 'purple', bg: 'bg-primary-100',  text: 'text-primary-800', label: '보라' },
  { value: 'amber',  bg: 'bg-amber-100',    text: 'text-amber-800',   label: '주황' },
  { value: 'blue',   bg: 'bg-blue-100',     text: 'text-blue-800',    label: '파랑' },
  { value: 'green',  bg: 'bg-green-100',    text: 'text-green-800',   label: '초록' },
  { value: 'red',    bg: 'bg-red-100',      text: 'text-red-800',     label: '빨강' },
  { value: 'gray',   bg: 'bg-gray-100',     text: 'text-gray-700',    label: '회색' },
]
const COLOR_MAP: Record<string, { bg: string; text: string }> = Object.fromEntries(
  COLORS.map(c => [c.value, { bg: c.bg, text: c.text }])
)
const getColor = (color?: string) => COLOR_MAP[color ?? 'purple'] ?? COLOR_MAP['purple']

const ROLE_LABEL: Record<string, string> = {
  ADMIN:'관리자', HQ_CHIEF:'본부장', HQ_MEMBER:'본부멤버', BIZ_REP:'사업장대표', ETC:'기타'
}

export default function CalendarPage() {
  const { user, loading } = useAuth()
  const router   = useRouter()

  const [events,   setEvents]   = useState<CalendarEvent[]>([])
  const [pending,  setPending]  = useState<CalendarEvent[]>([])
  const [allUsers, setAllUsers] = useState<AppUser[]>([])

  const today = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  // 모달
  const [modal,        setModal]        = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [editEvent,    setEditEvent]    = useState<CalendarEvent | null>(null)

  // 폼
  const [title,       setTitle]       = useState('')
  const [memo,        setMemo]        = useState('')
  const [location,    setLocation]    = useState('')
  const [allDay,      setAllDay]      = useState(false)
  const [timeHour,    setTimeHour]    = useState('09')
  const [timeMin,     setTimeMin]     = useState('00')
  const [timeAmPm,    setTimeAmPm]    = useState<'AM'|'PM'>('AM')
  const [isImportant, setIsImportant] = useState(false)
  const [isShared,    setIsShared]    = useState(false)
  const [sharedUids,  setSharedUids]  = useState<string[]>([])
  const [reminder,    setReminder]    = useState('')
  const [color,       setColor]       = useState('purple')
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState('')

  const [lunarDates,  setLunarDates]  = useState<Record<string, string>>({})
  const [holidays,    setHolidays]    = useState<Holiday[]>([])
  const dragId = useRef<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    const u1 = listenEvents(user.uid, user.bizId, setEvents)
    const u2 = listenPendingSharedEvents(user.uid, setPending)
    const u3 = listenUsers(setAllUsers)
    return () => { u1(); u2(); u3() }
  }, [user, router])

  // ── 달력 계산 ─────────────────────────────────────
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const lastDate = new Date(viewYear, viewMonth + 1, 0).getDate()
  const todayStr = today.toISOString().slice(0, 10)

  const getDateStr = (d: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`

  const eventsOnDate = (dStr: string) =>
    events
      .filter(e => e.date === dStr && !e.isDone)
      .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))

  const importantEvents = events
    .filter(e => e.isImportant && !e.isDone && e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  // ── 폼 초기화 ──────────────────────────────────────
  const resetForm = () => {
    setTitle(''); setMemo(''); setLocation('')
    setAllDay(false)
    setTimeHour('09'); setTimeMin('00'); setTimeAmPm('AM')
    setIsImportant(false); setIsShared(false)
    setSharedUids([]); setReminder(''); setColor('purple')
    setSaveError('')
  }

  const openAddModal = (dateStr: string) => {
    resetForm()
    setSelectedDate(dateStr)
    setEditEvent(null)
    setModal(true)
  }

  const openEditModal = (e: CalendarEvent) => {
    setSelectedDate(e.date)
    setEditEvent(e)
    setTitle(e.title)
    setMemo(e.memo ?? '')
    setLocation(e.location ?? '')
    setIsImportant(!!e.isImportant)
    setIsShared(!!(e.sharedWith?.length))
    setSharedUids(e.sharedWith ?? [])
    setColor((e as CalendarEvent & { color?: string }).color ?? 'purple')
    setSaveError('')
    if (e.time) {
      const [h, m] = e.time.split(':').map(Number)
      setAllDay(false)
      setTimeAmPm(h >= 12 ? 'PM' : 'AM')
      setTimeHour(String(h > 12 ? h - 12 : h === 0 ? 12 : h).padStart(2,'0'))
      setTimeMin(String(m).padStart(2,'0'))
    } else {
      setAllDay(true)
    }
    if (e.reminder) {
      setReminder(`${e.reminder.value}:${e.reminder.unit}`)
    } else {
      setReminder('')
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

  const formatDateKo = (dStr: string) => {
    const d = new Date(dStr + 'T00:00:00')
    return d.toLocaleDateString('ko-KR', { month:'long', day:'numeric', weekday:'short' })
  }

  // ── 저장 ──────────────────────────────────────────
  const handleSave = async () => {
    if (!user || !title.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      const data: Omit<CalendarEvent, 'id' | 'createdAt'> & { color?: string } = {
        title:      title.trim(),
        date:       selectedDate,
        time:       allDay ? undefined : getTime24(),
        memo:       memo.trim() || undefined,
        location:   location.trim() || undefined,
        isImportant,
        color,
        ownerUid:   user.uid,
        ownerName:  user.name,
        isDone:     false,
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
        const docRef = await addEvent(data)
        eventId = (docRef as { id: string }).id
      }

      // 공유 처리
      if (isShared && sharedUids.length > 0) {
        await shareEvent(eventId, sharedUids, [])
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

      setModal(false)
      resetForm()
    } catch (e) {
      setSaveError('저장 중 오류가 발생했습니다. 다시 시도해주세요.')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('일정을 삭제하시겠습니까?')) return
    await deleteEvent(id)
    setModal(false)
  }

  const toggleDone = async (e: CalendarEvent) => {
    await updateEvent(e.id, {
      isDone: !e.isDone,
      doneAt: !e.isDone ? new Date().toISOString() : undefined
    })
  }

  const toggleShareUser = (uid: string) =>
    setSharedUids(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid])

  const shareTargets = allUsers.filter(u => u.uid !== user?.uid)
  const allSelected  = shareTargets.length > 0 && sharedUids.length === shareTargets.length

  const handleDrop = async (dateStr: string) => {
    if (!dragId.current) return
    const ev = events.find(e => e.id === dragId.current)
    if (ev && ev.date !== dateStr) await updateEvent(ev.id, { date: dateStr })
    dragId.current = null
  }

  const [dragOverDate, setDragOverDate] = useState('')

  return (
    <AppShell title="캘린더">
      <div className="max-w-5xl mx-auto p-4 space-y-4">

        {/* 삭제 정책 안내 */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-400">
          <span>🗑</span>
          <span>완료된 일정은 <strong className="text-gray-500">1개월 후</strong> 자동 삭제됩니다</span>
        </div>

        {/* 공유 대기 알림 */}
        {pending.length > 0 && (
          <div className="space-y-2">
            {pending.map(e => (
              <div key={e.id} className="bg-primary-50 border border-primary-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-primary-900 mb-1">
                  📅 {e.ownerName}님이 일정을 공유했습니다
                </p>
                <p className="text-sm text-primary-700 mb-3">
                  "{e.title}" — {formatDateKo(e.date)}{e.time ? ` ${e.time}` : ''}
                  {e.location ? ` · ${e.location}` : ''}
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
              {importantEvents.map(e => {
                const c = getColor((e as CalendarEvent & {color?:string}).color)
                return (
                  <button key={e.id} onClick={() => openEditModal(e)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3">
                    <div className={clsx('w-2 h-2 rounded-full shrink-0', c.bg.replace('bg-','bg-').replace('-100','-400'))} style={{ background: '#F59E0B' }}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
                      <p className="text-xs text-gray-400">
                        {formatDateKo(e.date)}{e.time ? ` ${e.time}` : ''}
                        {e.location ? ` · ${e.location}` : ''}
                      </p>
                    </div>
                    {(e.sharedWith?.length ?? 0) > 0 && (
                      <Share2 size={12} className="text-primary-400 shrink-0"/>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 월간 달력 */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* 헤더 */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <ChevronLeft size={16}/>
              </button>
              <h3 className="font-semibold text-gray-900 min-w-[100px] text-center">
                {viewYear}년 {viewMonth + 1}월
              </h3>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <ChevronRight size={16}/>
              </button>
            </div>
            <button onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()) }}
              className="text-xs text-primary-600 border border-primary-200 px-2.5 py-1 rounded-lg hover:bg-primary-50">
              오늘
            </button>
          </div>

          {/* 요일 */}
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
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`e${i}`} className="min-h-[90px] border-r border-b border-gray-50 bg-gray-50/30"/>
            ))}
            {Array.from({ length: lastDate }, (_, i) => {
              const d    = i + 1
              const dStr = getDateStr(d)
              const isToday   = dStr === todayStr
              const dow       = (firstDay + i) % 7
              const dayEvents = eventsOnDate(dStr)
              const isDragOver = dragOverDate === dStr

              const holidayName = getHolidayName(holidays, viewYear, viewMonth + 1, d)
              const isRed = dow === 0 || dow === 6 || !!holidayName
              const lunarText = lunarDates[dStr] ?? ''
              return (
                <div key={d}
                  className={clsx(
                    'min-h-[90px] border-r border-b border-gray-50 p-1 cursor-pointer transition-colors',
                    isToday    ? 'bg-primary-50/40' :
                    isRed      ? 'bg-red-50/30' : 'hover:bg-gray-50',
                    isDragOver ? 'bg-primary-100 ring-2 ring-primary-400 ring-inset' : ''
                  )}
                  onClick={() => openAddModal(dStr)}
                  onDragOver={e => { e.preventDefault(); setDragOverDate(dStr) }}
                  onDragLeave={() => setDragOverDate('')}
                  onDrop={() => { handleDrop(dStr); setDragOverDate('') }}
                >
                  {/* 양력+음력 영역 */}
                  <div className="flex flex-col items-start mb-0.5">
                    <div className={clsx(
                      'w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full',
                      isToday ? 'bg-primary-600 text-white' :
                      isRed   ? 'text-red-500' : 'text-gray-800'
                    )}>
                      {d}
                    </div>
                    {/* 음력 또는 공휴일 */}
                    {holidayName ? (
                      <span className="text-[9px] text-red-500 font-medium leading-tight mt-0.5 truncate w-full">
                        {holidayName}
                      </span>
                    ) : lunarText ? (
                      <span className="text-[9px] text-gray-400 leading-tight mt-0.5">
                        {lunarText}
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(ev => {
                      const c = getColor((ev as CalendarEvent & {color?:string}).color)
                      return (
                        <div key={ev.id}
                          className={clsx('text-xs px-1.5 py-0.5 rounded truncate cursor-grab active:opacity-60', c.bg, c.text)}
                          draggable
                          onDragStart={e => { e.stopPropagation(); dragId.current = ev.id }}
                          onDragEnd={() => setDragOverDate('')}
                          onClick={e => { e.stopPropagation(); openEditModal(ev) }}
                        >
                          {ev.time && !allDay ? `${ev.time} ` : ''}{ev.title}
                        </div>
                      )
                    })}
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
          onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-gray-900 text-sm">
                {editEvent ? '일정 수정' : `일정 추가 — ${formatDateKo(selectedDate)}`}
              </h3>
              <button onClick={() => { setModal(false); resetForm() }} className="text-gray-400 hover:text-gray-600">
                <X size={20}/>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* 제목 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">제목 *</label>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="일정 제목을 입력하세요"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              </div>

              {/* 색상 선택 */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">색상</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c.value} onClick={() => setColor(c.value)}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors',
                        c.bg, c.text,
                        color === c.value ? 'ring-2 ring-offset-1 ring-primary-400' : 'opacity-70'
                      )}>
                      {color === c.value && '✓ '}{c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 시간 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-gray-400"/>
                  <label className="text-sm font-medium text-gray-700 flex-1">시간</label>
                  <button onClick={() => setAllDay(v => !v)}
                    className={clsx('text-xs px-3 py-1 rounded-lg border transition-colors',
                      allDay ? 'bg-gray-100 border-gray-300 text-gray-600' : 'bg-primary-50 border-primary-300 text-primary-700')}>
                    {allDay ? '종일' : '시간 있음'}
                  </button>
                </div>
                {!allDay && (
                  <div className="flex gap-2">
                    <button onClick={() => setTimeAmPm('AM')}
                      className={clsx('px-4 py-2 rounded-lg text-sm border font-medium transition-colors',
                        timeAmPm==='AM' ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600')}>
                      오전
                    </button>
                    <button onClick={() => setTimeAmPm('PM')}
                      className={clsx('px-4 py-2 rounded-lg text-sm border font-medium transition-colors',
                        timeAmPm==='PM' ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600')}>
                      오후
                    </button>
                    <select value={timeHour} onChange={e => setTimeHour(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                      {Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0')).map(h=>(
                        <option key={h} value={h}>{h}시</option>
                      ))}
                    </select>
                    <select value={timeMin} onChange={e => setTimeMin(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
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
                  {[
                    { v: '',         l: '없음' },
                    { v: '10:minutes', l: '10분 전' },
                    { v: '30:minutes', l: '30분 전' },
                    { v: '1:hours',    l: '1시간 전' },
                    { v: '3:hours',    l: '3시간 전' },
                    { v: '1:days',     l: '1일 전' },
                  ].map(opt => (
                    <button key={opt.v} onClick={() => setReminder(opt.v)}
                      className={clsx('px-3 py-1.5 rounded-lg text-xs border transition-colors',
                        reminder === opt.v
                          ? 'bg-primary-50 border-primary-300 text-primary-700'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50')}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* 주요일정 */}
              <button onClick={() => setIsImportant(v => !v)}
                className={clsx('w-full flex items-center gap-3 px-4 py-3 border rounded-xl transition-colors',
                  isImportant ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200 hover:bg-gray-50')}>
                <Star size={16} className={isImportant ? 'text-amber-500' : 'text-gray-400'}/>
                <div className="flex-1 text-left">
                  <p className={clsx('text-sm font-medium', isImportant ? 'text-amber-800' : 'text-gray-700')}>
                    주요일정으로 등록
                  </p>
                  <p className="text-xs text-gray-400">캘린더 상단에 항상 표시됩니다</p>
                </div>
                <div className={clsx('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                  isImportant ? 'border-amber-500 bg-amber-500' : 'border-gray-300')}>
                  {isImportant && <span className="text-white text-xs font-bold">✓</span>}
                </div>
              </button>

              {/* 일정 공유 */}
              <div>
                <button onClick={() => setIsShared(v => !v)}
                  className={clsx('w-full flex items-center gap-3 px-4 py-3 border rounded-xl transition-colors',
                    isShared ? 'bg-primary-50 border-primary-300' : 'bg-white border-gray-200 hover:bg-gray-50')}>
                  <Share2 size={16} className={isShared ? 'text-primary-500' : 'text-gray-400'}/>
                  <div className="flex-1 text-left">
                    <p className={clsx('text-sm font-medium', isShared ? 'text-primary-800' : 'text-gray-700')}>
                      일정 공유
                    </p>
                    <p className="text-xs text-gray-400">팀원/대표 캘린더에 공유합니다</p>
                  </div>
                  <div className={clsx('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                    isShared ? 'border-primary-500 bg-primary-500' : 'border-gray-300')}>
                    {isShared && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                </button>

                {isShared && shareTargets.length > 0 && (
                  <div className="mt-2 border border-primary-100 rounded-xl overflow-hidden">
                    {/* 전체 선택 */}
                    <div className="px-4 py-2.5 bg-primary-50 border-b border-primary-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users size={13} className="text-primary-500"/>
                        <span className="text-xs font-medium text-primary-700">공유 대상 선택</span>
                      </div>
                      <button onClick={() => setSharedUids(allSelected ? [] : shareTargets.map(u => u.uid))}
                        className={clsx('text-xs px-3 py-1 rounded-lg border transition-colors',
                          allSelected ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-primary-300 text-primary-600')}>
                        {allSelected ? '전체 해제' : '전체 선택'}
                      </button>
                    </div>
                    {shareTargets.map(u => (
                      <button key={u.uid} onClick={() => toggleShareUser(u.uid)}
                        className={clsx(
                          'w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 transition-colors',
                          sharedUids.includes(u.uid) ? 'bg-primary-50/50' : 'hover:bg-gray-50'
                        )}>
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                          {u.name?.[0]}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-gray-800">{u.name}</p>
                          <p className="text-xs text-gray-400">{ROLE_LABEL[u.role] ?? u.role}</p>
                        </div>
                        <div className={clsx('w-5 h-5 rounded border-2 flex items-center justify-center shrink-0',
                          sharedUids.includes(u.uid) ? 'border-primary-600 bg-primary-600' : 'border-gray-400 bg-white')}>
                          {sharedUids.includes(u.uid) && (
                            <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                              <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 오류 메시지 */}
              {saveError && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {saveError}
                </p>
              )}

              {/* 버튼 */}
              <div className="flex gap-2 pt-2">
                {editEvent && (
                  <button onClick={() => handleDelete(editEvent.id)}
                    className="flex items-center gap-2 border border-red-200 text-red-500 px-4 py-3 rounded-xl text-sm hover:bg-red-50 transition-colors">
                    <Trash2 size={14}/> 삭제
                  </button>
                )}
                {editEvent && (
                  <button onClick={() => { toggleDone(editEvent); setModal(false) }}
                    className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                    <CheckCircle2 size={14}/>
                    {editEvent.isDone ? '미완료로' : '완료'}
                  </button>
                )}
                <button onClick={handleSave} disabled={!title.trim() || saving}
                  className="flex-1 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 transition-colors">
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
