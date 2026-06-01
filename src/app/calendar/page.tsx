'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenEvents, addEvent, updateEvent, deleteEvent } from '@/lib/db'
import type { CalendarEvent, EventReminder, ReminderUnit } from '@/types'
import { Calendar, Plus, Trash2, CheckCircle2, Circle, Bell, X, ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'

const REMINDER_OPTIONS: { value: number; unit: ReminderUnit; label: string }[] = [
  { value: 10,  unit: 'minutes', label: '10분 전' },
  { value: 30,  unit: 'minutes', label: '30분 전' },
  { value: 1,   unit: 'hours',   label: '1시간 전' },
  { value: 3,   unit: 'hours',   label: '3시간 전' },
  { value: 1,   unit: 'days',    label: '1일 전' },
]

export default function CalendarPage() {
  const { user }  = useAuth()
  const router    = useRouter()
  const [events,   setEvents]   = useState<CalendarEvent[]>([])
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  // 폼
  const [title,    setTitle]    = useState('')
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10))
  const [time,     setTime]     = useState('')
  const [memo,     setMemo]     = useState('')
  const [reminder, setReminder] = useState<EventReminder | undefined>(undefined)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    if (!user) { router.replace('/login'); return }
    return listenEvents(user.uid, user.bizId, setEvents)
  }, [user, router])

  const handleSubmit = async () => {
    if (!user || !title.trim() || !date) return
    setSaving(true)
    await addEvent({
      title: title.trim(), date, time, memo,
      ownerUid: user.uid, ownerName: user.name,
      reminder, isDone: false,
    })
    setTitle(''); setTime(''); setMemo(''); setReminder(undefined)
    setShowForm(false)
    setSaving(false)
  }

  const toggleDone = async (e: CalendarEvent) => {
    const isDone = !e.isDone
    await updateEvent(e.id, { isDone, doneAt: isDone ? new Date().toISOString() : undefined })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('일정을 삭제하시겠습니까?')) return
    await deleteEvent(id)
  }

  // 날짜별 그룹
  const today   = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter(e => !e.isDone && e.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const done     = events.filter(e => e.isDone).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))

  const formatDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
  }

  const reminderLabel = (r?: EventReminder) => {
    if (!r) return ''
    const opt = REMINDER_OPTIONS.find(o => o.value === r.value && o.unit === r.unit)
    return opt ? opt.label : ''
  }

  const EventCard = ({ e }: { e: CalendarEvent }) => {
    const isOpen = expanded === e.id
    const canEdit = user?.role === 'ADMIN' || e.ownerUid === user?.uid
    return (
      <div className={clsx('bg-white border rounded-2xl overflow-hidden',
        e.isDone ? 'border-gray-100 opacity-60' : 'border-gray-200')}>
        <div className="flex items-start gap-3 px-4 py-3.5">
          <button onClick={() => toggleDone(e)} className="mt-0.5 shrink-0">
            {e.isDone
              ? <CheckCircle2 size={20} className="text-green-500"/>
              : <Circle size={20} className="text-gray-300 hover:text-primary-400"/>}
          </button>
          <button className="flex-1 text-left min-w-0" onClick={() => setExpanded(isOpen ? null : e.id)}>
            <p className={clsx('font-medium text-sm', e.isDone ? 'line-through text-gray-400' : 'text-gray-900')}>
              {e.title}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-400">{formatDate(e.date)}{e.time ? ` ${e.time}` : ''}</span>
              {e.reminder && (
                <span className="flex items-center gap-0.5 text-xs text-primary-500">
                  <Bell size={10}/>{reminderLabel(e.reminder)}
                </span>
              )}
            </div>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && (
              <button onClick={() => handleDelete(e.id)} className="p-1.5 text-gray-300 hover:text-red-500">
                <Trash2 size={14}/>
              </button>
            )}
            {isOpen ? <ChevronUp size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
          </div>
        </div>
        {isOpen && e.memo && (
          <div className="px-12 pb-3 border-t border-gray-50 pt-2">
            <p className="text-xs text-gray-500 whitespace-pre-wrap">{e.memo}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <AppShell title="캘린더">
      <div className="max-w-4xl mx-auto p-4 space-y-4">

        {/* 추가 버튼 */}
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors">
            <Plus size={16}/> 일정 추가
          </button>
        )}

        {/* 추가 폼 */}
        {showForm && (
          <div className="bg-white border border-primary-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">일정 추가</h3>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400"/></button>
            </div>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="일정 제목"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">날짜</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">시간 (선택)</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">
                <Bell size={12} className="inline mr-1"/>알림 설정 (선택)
              </label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setReminder(undefined)}
                  className={clsx('px-3 py-1.5 rounded-lg text-xs border transition-colors',
                    !reminder ? 'bg-primary-50 border-primary-400 text-primary-700' : 'bg-white border-gray-200 text-gray-500')}>
                  없음
                </button>
                {REMINDER_OPTIONS.map(opt => (
                  <button key={opt.label}
                    onClick={() => setReminder({ value: opt.value, unit: opt.unit })}
                    className={clsx('px-3 py-1.5 rounded-lg text-xs border transition-colors',
                      reminder?.value === opt.value && reminder?.unit === opt.unit
                        ? 'bg-primary-50 border-primary-400 text-primary-700'
                        : 'bg-white border-gray-200 text-gray-500')}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea value={memo} onChange={e => setMemo(e.target.value)}
              placeholder="메모 (선택)" rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
            <button onClick={handleSubmit} disabled={!title.trim() || !date || saving}
              className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-800 disabled:opacity-50">
              {saving ? '저장 중...' : '일정 저장'}
            </button>
          </div>
        )}

        {/* 예정 일정 */}
        {upcoming.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">예정 일정</h3>
            <div className="space-y-2">
              {upcoming.map(e => <EventCard key={e.id} e={e}/>)}
            </div>
          </div>
        )}

        {/* 완료된 일정 */}
        {done.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">완료됨</h3>
            <div className="space-y-2">
              {done.slice(0, 5).map(e => <EventCard key={e.id} e={e}/>)}
            </div>
          </div>
        )}

        {events.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Calendar size={32} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">등록된 일정이 없습니다</p>
          </div>
        )}
      </div>
    </AppShell>
  )
}
