'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenNotices, addNotice, deleteNotice } from '@/lib/db'
import type { Notice, NoticePrefix } from '@/types'
import { Megaphone, Plus, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'

export default function NoticesPage() {
  const { user }   = useAuth()
  const router     = useRouter()
  const [notices, setNotices]       = useState<Notice[]>([])
  const [showForm, setShowForm]     = useState(false)
  const [expanded, setExpanded]     = useState<string | null>(null)

  // 작성 폼
  const [prefix,    setPrefix]    = useState<NoticePrefix>('본부')
  const [title,     setTitle]     = useState('')
  const [body,      setBody]      = useState('')
  const [expiresAt,   setExpiresAt]   = useState('')
  const [showPicker,  setShowPicker]  = useState(false)
  const [pickYear,    setPickYear]    = useState(new Date().getFullYear())
  const [pickMonth,   setPickMonth]   = useState(new Date().getMonth() + 1)
  const [pickDay,     setPickDay]     = useState(new Date().getDate())
  const [pickHour,    setPickHour]    = useState(23)
  const [pickMin,     setPickMin]     = useState(59)
  const [saving,    setSaving]    = useState(false)

  const isHQ = user?.role === 'ADMIN' || user?.role === 'HQ_CHIEF' || user?.role === 'HQ_MEMBER'
  const canWrite = user?.role === 'ADMIN' || user?.role === 'HQ_CHIEF' ||
                   user?.role === 'HQ_MEMBER' ||
                   user?.role === 'BIZ_REP'

  // 사업장 대표는 [사업장] 말머리만
  const prefixes: NoticePrefix[] = user?.role === 'BIZ_REP' ? ['사업장'] : ['본부', '사업장']

  useEffect(() => {
    if (!user) { router.replace('/login'); return }
    return listenNotices(setNotices)
  }, [user, router])

  const handleSubmit = async () => {
    if (!user || !title.trim() || !body.trim() || !expiresAt) return
    setSaving(true)
    await addNotice({
      prefix,
      title:      title.trim(),
      body:       body.trim(),
      authorUid:  user.uid,
      authorName: user.name,
      expiresAt:  new Date(expiresAt).toISOString(),
    })
    // 전체 푸시 발송 (비동기 - 블로킹 없음)
    setTimeout(() => {
      fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer hq-cleanup-2026' },
        body: JSON.stringify({
          title: `[공지] ${title.trim()}`,
          body:  body.trim().slice(0, 100),
          url:   '/notices',
        }),
      }).catch(() => {})
    }, 0)
    setTitle(''); setBody(''); setExpiresAt(''); setShowPicker(false)
    setShowForm(false)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 공지사항을 삭제하시겠습니까?')) return
    await deleteNotice(id)
  }

  const prefixColor = (p: NoticePrefix) =>
    p === '본부' ? 'bg-primary-100 text-primary-700' : 'bg-amber-100 text-amber-700'

  return (
    <AppShell title="공지사항">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-400">
          <span>🗑</span>
          <span>공지사항은 <strong className="text-gray-500">게시 종료일</strong>에 자동 삭제됩니다</span>
        </div>

        {/* 작성 버튼 */}
        {canWrite && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors">
            <Plus size={16}/> 공지사항 작성
          </button>
        )}

        {/* 작성 폼 */}
        {showForm && (
          <div className="bg-white border border-primary-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">공지사항 작성</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400"><X size={18}/></button>
            </div>
            {/* 말머리 */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">말머리</label>
              <div className="flex gap-2">
                {prefixes.map(p => (
                  <button key={p} onClick={() => setPrefix(p)}
                    className={clsx('px-4 py-2 rounded-xl text-sm font-medium border transition-colors',
                      prefix === p ? 'bg-primary-50 border-primary-400 text-primary-700' : 'bg-white border-gray-200 text-gray-600')}>
                    [{p}]
                  </button>
                ))}
              </div>
            </div>
            {/* 제목 */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">제목</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="공지 제목"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
            </div>
            {/* 내용 */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">내용</label>
              <textarea value={body} onChange={e => setBody(e.target.value)}
                rows={5} placeholder="공지 내용"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
            </div>
            {/* 게시 종료일 */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                게시 종료일 <span className="text-red-500">*</span>
              </label>
              {/* 날짜 표시 버튼 */}
              <button type="button" onClick={() => setShowPicker(v => !v)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-left focus:outline-none focus:ring-2 focus:ring-primary-400 flex items-center justify-between">
                <span className={expiresAt ? 'text-gray-900' : 'text-gray-400'}>
                  {expiresAt
                    ? `${pickYear}년 ${pickMonth}월 ${pickDay}일 ${pickHour}:${String(pickMin).padStart(2,'0')}`
                    : '종료일을 선택하세요'}
                </span>
                <span className="text-gray-400">📅</span>
              </button>

              {/* 날짜 피커 팝업 */}
              {showPicker && (() => {
                const daysInMonth = new Date(pickYear, pickMonth, 0).getDate()
                const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() + i)
                const months = Array.from({length: 12}, (_, i) => i + 1)
                const days = Array.from({length: daysInMonth}, (_, i) => i + 1)
                const hours = Array.from({length: 24}, (_, i) => i)
                const mins = [0, 10, 20, 30, 40, 50, 59]

                const applyDate = (y: number, mo: number, d: number, h: number, mi: number) => {
                  const dt = new Date(y, mo-1, d, h, mi)
                  setExpiresAt(dt.toISOString())
                }

                return (
                  <div className="mt-2 border border-primary-200 rounded-xl p-4 bg-white shadow-lg space-y-3">
                    {/* 연도/월/일 */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">연도</label>
                        <select value={pickYear}
                          onChange={e => { const y=+e.target.value; setPickYear(y); applyDate(y,pickMonth,pickDay,pickHour,pickMin) }}
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                          {years.map(y => <option key={y} value={y}>{y}년</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">월</label>
                        <select value={pickMonth}
                          onChange={e => { const mo=+e.target.value; setPickMonth(mo); applyDate(pickYear,mo,pickDay,pickHour,pickMin) }}
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                          {months.map(m => <option key={m} value={m}>{m}월</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">일</label>
                        <select value={pickDay}
                          onChange={e => { const d=+e.target.value; setPickDay(d); applyDate(pickYear,pickMonth,d,pickHour,pickMin) }}
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                          {days.map(d => <option key={d} value={d}>{d}일</option>)}
                        </select>
                      </div>
                    </div>
                    {/* 시간 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">시</label>
                        <select value={pickHour}
                          onChange={e => { const h=+e.target.value; setPickHour(h); applyDate(pickYear,pickMonth,pickDay,h,pickMin) }}
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                          {hours.map(h => <option key={h} value={h}>{h}시</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">분</label>
                        <select value={pickMin}
                          onChange={e => { const mi=+e.target.value; setPickMin(mi); applyDate(pickYear,pickMonth,pickDay,pickHour,mi) }}
                          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                          {mins.map(m => <option key={m} value={m}>{String(m).padStart(2,'0')}분</option>)}
                        </select>
                      </div>
                    </div>
                    <button type="button" onClick={() => setShowPicker(false)}
                      className="w-full py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-800">
                      확인
                    </button>
                  </div>
                )
              })()}
              <p className="text-xs text-gray-400 mt-1">종료일 이후 자동으로 삭제됩니다</p>
            </div>
            <button onClick={handleSubmit}
              disabled={!title.trim() || !body.trim() || !expiresAt || saving}
              className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-800 disabled:opacity-50">
              {saving ? '등록 중...' : '공지 등록'}
            </button>
          </div>
        )}

        {/* 공지 목록 */}
        {notices.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Megaphone size={32} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">등록된 공지사항이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notices.map(n => {
              const isOpen = expanded === n.id
              const canDel = user?.role === 'ADMIN' || user?.uid === n.authorUid
              const expDate = new Date(n.expiresAt).toLocaleDateString('ko-KR')
              return (
                <div key={n.id}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <button className="w-full text-left px-5 py-4"
                    onClick={() => setExpanded(isOpen ? null : n.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', prefixColor(n.prefix))}>
                            [{n.prefix}]
                          </span>
                          <span className="text-xs text-gray-400">{n.authorName}</span>
                          <span className="text-xs text-gray-300">~{expDate}</span>
                        </div>
                        <p className="font-medium text-gray-900 text-sm">{n.title}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canDel && (
                          <button onClick={e => { e.stopPropagation(); handleDelete(n.id) }}
                            className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg">
                            <Trash2 size={14}/>
                          </button>
                        )}
                        {isOpen ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
                      </div>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 border-t border-gray-100 pt-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{n.body}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
