'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenBusinesses, sendMessage, listenTemplates, addTemplate, deleteTemplate } from '@/lib/db'
import type { Business, Receipt, MessageTemplate, MessageCategory } from '@/types'
import {
  Send, CheckSquare, Square, AlertCircle, Calendar, Link2,
  FileText, Plus, Trash2, X, ChevronDown
} from 'lucide-react'
import clsx from 'clsx'

function ComposeContent() {
  const { user }     = useAuth()
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [title,      setTitle]      = useState('')
  const [body,       setBody]       = useState('')
  const [category,   setCategory]   = useState<'instruction' | 'confirm' | 'notice'>('instruction')
  const [priority,   setPriority]   = useState<'normal' | 'urgent'>('normal')
  const [sending,    setSending]    = useState(false)
  const [sent,       setSent]       = useState(false)

  // 일정 첨부
  const [showEvent,  setShowEvent]  = useState(false)
  const [eventDate,  setEventDate]  = useState('')
  const [eventTime,  setEventTime]  = useState('')
  const [eventTitle, setEventTitle] = useState('')

  // 링크 첨부
  const [showLink,   setShowLink]   = useState(false)
  const [linkUrl,    setLinkUrl]    = useState('')
  const [linkLabel,  setLinkLabel]  = useState('')

  // 템플릿
  const [templates,    setTemplates]    = useState<MessageTemplate[]>([])
  const [showTpl,      setShowTpl]      = useState(false)
  const [tplTitle,     setTplTitle]     = useState('')
  const [showSaveTpl,  setShowSaveTpl]  = useState(false)

  const canSend = user?.role === 'ADMIN' || user?.role === 'HQ_CHIEF' || user?.role === 'HQ_MEMBER'

  useEffect(() => {
    if (!canSend) { router.replace('/dashboard'); return }
    const u1 = listenBusinesses(setBusinesses)
    const u2 = user ? listenTemplates(user.uid, setTemplates) : () => {}
    return () => { u1(); u2() }
  }, [canSend, router, user])

  useEffect(() => {
    const bizId = searchParams.get('biz')
    if (bizId) setSelected(new Set([bizId]))
    // 전달에서 일정 첨부로 넘어온 경우
    const ed = searchParams.get('eventDate')
    const et = searchParams.get('eventTime')
    const etl = searchParams.get('eventTitle')
    if (ed) { setEventDate(ed); setShowEvent(true) }
    if (et) setEventTime(et)
    if (etl) setEventTitle(etl)
  }, [searchParams])

  const toggleAll = () => setSelected(
    selected.size === businesses.length ? new Set() : new Set(businesses.map(b => b.id))
  )
  const toggle = (bizId: string) => {
    const next = new Set(selected)
    next.has(bizId) ? next.delete(bizId) : next.add(bizId)
    setSelected(next)
  }

  const handleSend = async () => {
    if (!user || !title.trim() || !body.trim() || selected.size === 0) return
    setSending(true)
    const receipts: Receipt[] = Array.from(selected).map(bizId => ({
      bizId,
      bizName: businesses.find(b => b.id === bizId)?.name ?? bizId,
      status: 'pending' as const,
    }))
    await sendMessage({
      title: title.trim(), body: body.trim(), category, priority,
      authorUid: user.uid, authorName: user.name,
      targetBizIds: Array.from(selected),
      receipts,
      ...(showEvent && eventDate ? { eventDate, eventTime, eventTitle: eventTitle || title } : {}),
      ...(showLink && linkUrl    ? { linkUrl, linkLabel: linkLabel || linkUrl }             : {}),
    })
    // 수신 사업장 대표에게 푸시 발송
    const categoryLabel = { instruction: '업무지시', confirm: '확인요청', notice: '단순공지' }[category]
    fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CLEANUP_SECRET}` },
      body: JSON.stringify({
        title: `[${categoryLabel}] ${title.trim()}`,
        body:  body.trim().slice(0, 100),
        url:   '/dashboard',
      }),
    }).catch(() => {})
    setSent(true)
    setSending(false)
  }

  const applyTemplate = (tpl: MessageTemplate) => {
    setTitle(tpl.title); setBody(tpl.body)
    setShowTpl(false)
  }

  const saveTemplate = async () => {
    if (!user || !title.trim() || !body.trim()) return
    await addTemplate({ ownerUid: user.uid, title: tplTitle || title, body })
    setShowSaveTpl(false); setTplTitle('')
  }

  if (sent) return (
    <AppShell title="전달 작성">
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <CheckSquare size={32} className="text-green-600"/>
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-900">발송 완료!</p>
          <p className="text-sm text-gray-500 mt-1">{selected.size}개 사업장에 전달되었습니다</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setSent(false); setTitle(''); setBody(''); setSelected(new Set()) }}
            className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">
            새 전달 작성
          </button>
          <button onClick={() => router.push('/businesses')}
            className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-800">
            사업장 현황 보기
          </button>
        </div>
      </div>
    </AppShell>
  )

  return (
    <AppShell title="전달 작성">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">

        {/* 전달 종류 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">전달 종류</label>
          <div className="flex gap-2">
            {([
              { value: 'instruction', label: '업무지시', color: 'bg-amber-50 border-amber-300 text-amber-700' },
              { value: 'confirm',     label: '확인요청', color: 'bg-blue-50 border-blue-300 text-blue-700' },
              { value: 'notice',      label: '단순공지', color: 'bg-gray-50 border-gray-300 text-gray-600' },
            ] as const).map(c => (
              <button key={c.value} onClick={() => setCategory(c.value)}
                className={clsx('flex-1 py-2 rounded-xl text-sm font-medium border transition-colors',
                  category === c.value ? c.color : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50')}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

                {/* 우선순위 */}
        <div className="flex gap-2">
          {(['normal', 'urgent'] as const).map(p => (
            <button key={p} onClick={() => setPriority(p)}
              className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors',
                priority === p
                  ? p === 'urgent' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-primary-50 border-primary-300 text-primary-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}>
              {p === 'urgent' && <AlertCircle size={15}/>}
              {p === 'normal' ? '일반' : '긴급'}
            </button>
          ))}
          {/* 템플릿 불러오기 */}
          <div className="ml-auto relative">
            <button onClick={() => setShowTpl(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
              <FileText size={15}/> 템플릿
              <ChevronDown size={12}/>
            </button>
            {showTpl && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                {templates.length === 0 ? (
                  <p className="text-xs text-gray-400 p-4 text-center">저장된 템플릿이 없습니다</p>
                ) : templates.map(tpl => (
                  <button key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-800 truncate">{tpl.title}</span>
                    <button onClick={async (e) => { e.stopPropagation(); await deleteTemplate(tpl.id) }}
                      className="text-gray-300 hover:text-red-400 ml-2 shrink-0">
                      <Trash2 size={13}/>
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 제목 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">제목</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="전달 제목을 입력하세요"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
        </div>

        {/* 내용 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">내용</label>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="전달 내용을 입력하세요" rows={6}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
          {/* 템플릿 저장 */}
          {(title.trim() || body.trim()) && !showSaveTpl && (
            <button onClick={() => setShowSaveTpl(true)}
              className="mt-1.5 text-xs text-primary-500 hover:underline flex items-center gap-1">
              <Plus size={11}/> 템플릿으로 저장
            </button>
          )}
          {showSaveTpl && (
            <div className="mt-2 flex gap-2">
              <input value={tplTitle} onChange={e => setTplTitle(e.target.value)}
                placeholder={title || '템플릿 이름'}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              <button onClick={saveTemplate}
                className="px-3 py-2 bg-primary-600 text-white rounded-lg text-xs hover:bg-primary-800">저장</button>
              <button onClick={() => setShowSaveTpl(false)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500">취소</button>
            </div>
          )}
        </div>

        {/* 첨부 옵션 */}
        <div className="flex gap-2">
          <button onClick={() => setShowEvent(v => !v)}
            className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors',
              showEvent ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}>
            <Calendar size={13}/> 일정 첨부
          </button>
          <button onClick={() => setShowLink(v => !v)}
            className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors',
              showLink ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50')}>
            <Link2 size={13}/> 링크 첨부
          </button>
        </div>

        {/* 일정 첨부 폼 */}
        {showEvent && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-700">일정 첨부</span>
              <button onClick={() => { setShowEvent(false); setEventDate(''); setEventTime('') }}>
                <X size={14} className="text-blue-400"/>
              </button>
            </div>
            <input value={eventTitle} onChange={e => setEventTitle(e.target.value)}
              placeholder="일정 제목 (비우면 전달 제목 사용)"
              className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"/>
            <div className="flex gap-2">
              <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"/>
              <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)}
                className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"/>
            </div>
            <p className="text-xs text-blue-500">수신자가 캘린더에 추가할 수 있습니다</p>
          </div>
        )}

        {/* 링크 첨부 폼 */}
        {showLink && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-green-700">링크 첨부</span>
              <button onClick={() => { setShowLink(false); setLinkUrl(''); setLinkLabel('') }}>
                <X size={14} className="text-green-400"/>
              </button>
            </div>
            <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://..." type="url"
              className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"/>
            <input value={linkLabel} onChange={e => setLinkLabel(e.target.value)}
              placeholder="링크 표시 이름 (선택)"
              className="w-full border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white"/>
          </div>
        )}

        {/* 수신 사업장 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">수신 사업장 ({selected.size}/{businesses.length})</label>
            <button onClick={toggleAll} className="text-xs text-primary-600 hover:underline font-medium">
              {selected.size === businesses.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {businesses.map(biz => (
              <button key={biz.id} onClick={() => toggle(biz.id)}
                className={clsx('w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors',
                  selected.has(biz.id) ? 'bg-primary-50' : 'bg-white')}>
                {selected.has(biz.id)
                  ? <CheckSquare size={18} className="text-primary-600 shrink-0"/>
                  : <Square size={18} className="text-gray-300 shrink-0"/>}
                <span className="text-sm font-medium text-gray-800">{biz.name}</span>
                {biz.repName && <span className="text-xs text-gray-400 ml-auto">{biz.repName}</span>}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleSend}
          disabled={!title.trim() || !body.trim() || selected.size === 0 || sending}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white rounded-xl py-3.5 font-medium text-sm hover:bg-primary-800 disabled:opacity-50 transition-colors">
          <Send size={16}/> {sending ? '발송 중...' : `${selected.size}개 사업장에 발송`}
        </button>
      </div>
    </AppShell>
  )
}

export default function ComposePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"/></div>}>
      <ComposeContent/>
    </Suspense>
  )
}
