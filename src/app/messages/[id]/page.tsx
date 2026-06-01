'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenMessages, processMessage, completeMessage, closeMessage, reopenMessage, hideMessage, replyDirect, addEventToMyCalendar, addEvent } from '@/lib/db'
import type { Message, Receipt } from '@/types'
import {
  CheckCircle2, Clock, AlertCircle, Send, CheckSquare,
  RotateCcw, Lock, Calendar, Link2, ExternalLink, ChevronDown, ChevronUp, EyeOff
} from 'lucide-react'
import clsx from 'clsx'

const CATEGORY_LABEL: Record<string, { label: string; color: string }> = {
  instruction: { label: '업무지시', color: 'bg-amber-100 text-amber-800' },
  confirm:     { label: '확인요청', color: 'bg-blue-100 text-blue-800' },
  notice:      { label: '단순공지', color: 'bg-gray-100 text-gray-600' },
}

export default function MessageDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const { user } = useAuth()
  const router   = useRouter()

  const [message,    setMessage]    = useState<Message | null>(null)
  const [replyText,  setReplyText]  = useState('')
  const [doneNote,   setDoneNote]   = useState('')
  const [sending,    setSending]    = useState(false)
  const [showNote,   setShowNote]   = useState(false)
  const [addedCal,   setAddedCal]   = useState(false)
  const [bizExpanded, setBizExpanded] = useState(false)

  const isAdmin = user?.role === 'ADMIN'
  const isHQ    = user?.role === 'ADMIN' || user?.role === 'HQ_CHIEF' || user?.role === 'HQ_MEMBER'
  const isBiz   = user?.role === 'BIZ_REP'

  useEffect(() => {
    return listenMessages(msgs => setMessage(msgs.find(m => m.id === id) ?? null))
  }, [id])

  if (!message) return (
    <AppShell title="전달 상세" back={isHQ ? '/businesses' : '/dashboard'}>
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">불러오는 중...</div>
    </AppShell>
  )

  const isDirect  = message.type === 'direct'
  const isDone    = message.status === 'done'
  const receipts  = message.receipts ?? []
  const replies   = message.replies ?? []
  const myReceipt = isBiz ? receipts.find(r => r.bizId === user?.bizId) : null

  // 사업장별 집계
  const total      = receipts.length
  const doneCount  = receipts.filter(r => r.status === 'done').length
  const procCount  = receipts.filter(r => r.status === 'processing').length
  const pendCount  = receipts.filter(r => r.status === 'pending').length

  const catInfo = CATEGORY_LABEL[message.category ?? 'instruction']

  // 처리하겠습니다
  const handleProcess = async () => {
    if (!user?.bizId) return
    setSending(true)
    await processMessage(message.id, user.bizId)
    setSending(false)
  }

  // 처리했습니다 (바로 완료)
  const handleComplete = async (note?: string) => {
    if (!user?.bizId) return
    setSending(true)
    await completeMessage(message.id, user.bizId, note)
    setSending(false)
    setShowNote(false)
    setDoneNote('')
  }

  // 본부 완결 처리
  const handleClose  = async () => { await closeMessage(message.id) }
  const handleReopen = async () => { await reopenMessage(message.id) }
  const handleHide   = async () => {
    if (!user?.bizId) return
    await hideMessage(message.id, user.bizId)
    router.push('/dashboard')
  }

  // 캘린더 추가
  const handleAddToCalendar = async () => {
    if (!user || !message.eventDate) return
    if (isBiz && user.bizId) await addEventToMyCalendar(message.id, user.bizId)
    else await addEvent({ title: message.eventTitle || message.title, date: message.eventDate, time: message.eventTime, ownerUid: user.uid, ownerName: user.name, isDone: false })
    setAddedCal(true)
  }

  // direct 답변
  const handleDirectReply = async () => {
    if (!replyText.trim()) return
    setSending(true)
    await replyDirect(message.id, user!.uid, user!.name, replyText.trim())
    setReplyText('')
    setSending(false)
  }

  const statusBadge = (r: Receipt) => {
    if (r.status === 'done')       return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">처리완료</span>
    if (r.status === 'processing') return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">처리중</span>
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800">미접수</span>
  }

  const statusIcon = (r: Receipt) => {
    if (r.status === 'done')       return <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm shrink-0">✓</div>
    if (r.status === 'processing') return <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">→</div>
    return <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-700 font-bold text-sm shrink-0">!</div>
  }

  return (
    <AppShell title="전달 상세" back={isHQ ? '/businesses' : '/dashboard'}>
      <div className="max-w-2xl mx-auto p-4 space-y-4">

        {/* 메시지 헤더 */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className={clsx('px-4 py-2.5 flex items-center gap-2 text-xs font-medium',
            isDone ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700')}>
            {isDone ? <><CheckCircle2 size={14}/> 처리완료</> : <><Clock size={14}/> 진행중</>}
            {message.priority === 'urgent' && (
              <span className="ml-1 flex items-center gap-1 text-red-600"><AlertCircle size={12}/> 긴급</span>
            )}
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full', catInfo.color)}>
                {catInfo.label}
              </span>
              {isDirect && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 flex items-center gap-1"><Lock size={10}/>1:1 비공개</span>}
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">{message.title}</h2>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{message.body}</div>
            <p className="text-xs text-gray-400 mt-3">{message.authorName}</p>

            {/* 일정 첨부 */}
            {message.eventDate && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-blue-500"/>
                  <div>
                    <p className="text-xs font-semibold text-blue-800">{message.eventTitle || message.title}</p>
                    <p className="text-xs text-blue-600">{message.eventDate}{message.eventTime ? ` ${message.eventTime}` : ''}</p>
                  </div>
                </div>
                {!addedCal
                  ? <button onClick={handleAddToCalendar} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1"><Calendar size={11}/> 캘린더 추가</button>
                  : <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 size={11}/> 추가됨</span>}
              </div>
            )}

            {/* 링크 첨부 */}
            {message.linkUrl && (
              <a href={message.linkUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 hover:bg-green-100 transition-colors">
                <Link2 size={15} className="text-green-600 shrink-0"/>
                <span className="text-xs text-green-800 flex-1 truncate">{message.linkLabel || message.linkUrl}</span>
                <ExternalLink size={12} className="text-green-500 shrink-0"/>
              </a>
            )}
          </div>
        </div>

        {/* ── 사업장 대표 화면 ── */}
        {isBiz && !isDirect && myReceipt && !myReceipt.hidden && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 space-y-4">

              {/* 단계 표시 */}
              <div className="space-y-3">
                {/* 1단계: 접수 */}
                <div className="flex items-start gap-3">
                  <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
                    myReceipt.status !== 'pending' ? 'bg-green-100 text-green-700 border-2 border-green-400' : 'bg-primary-600 text-white')}>
                    {myReceipt.status !== 'pending' ? '✓' : '1'}
                  </div>
                  <div>
                    <p className={clsx('text-sm font-medium', myReceipt.status !== 'pending' ? 'text-gray-500' : 'text-gray-900')}>접수</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {myReceipt.status !== 'pending' ? `${myReceipt.processedAt ? new Date(myReceipt.processedAt).toLocaleString('ko-KR', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '완료'} 접수됨` : '아직 접수하지 않은 전달입니다'}
                    </p>
                  </div>
                </div>

                {/* 2단계: 처리중 */}
                <div className="flex items-start gap-3">
                  <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
                    myReceipt.status === 'done' ? 'bg-green-100 text-green-700 border-2 border-green-400' :
                    myReceipt.status === 'processing' ? 'bg-primary-600 text-white' :
                    'bg-gray-100 text-gray-400 border-2 border-gray-200')}>
                    {myReceipt.status === 'done' ? '✓' : '2'}
                  </div>
                  <div>
                    <p className={clsx('text-sm font-medium',
                      myReceipt.status === 'processing' ? 'text-gray-900' : 'text-gray-400')}>처리중</p>
                    <p className="text-xs text-gray-400 mt-0.5">접수 후 자동 전환</p>
                  </div>
                </div>

                {/* 3단계: 완료 */}
                <div className="flex items-start gap-3">
                  <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
                    myReceipt.status === 'done' ? 'bg-primary-600 text-white' :
                    'bg-gray-100 text-gray-400 border-2 border-gray-200')}>
                    {myReceipt.status === 'done' ? '✓' : '3'}
                  </div>
                  <div>
                    <p className={clsx('text-sm font-medium', myReceipt.status === 'done' ? 'text-gray-900' : 'text-gray-400')}>완료</p>
                    {myReceipt.status === 'done' && myReceipt.doneAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(myReceipt.doneAt).toLocaleString('ko-KR', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})} 완료
                      </p>
                    )}
                    {myReceipt.doneNote && (
                      <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded-lg px-3 py-2">{myReceipt.doneNote}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 버튼 영역 */}
              {myReceipt.status === 'pending' && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <button onClick={handleProcess} disabled={sending}
                    className="w-full py-3 border-2 border-primary-300 text-primary-700 rounded-xl text-sm font-semibold hover:bg-primary-50 disabled:opacity-50 transition-colors">
                    처리하겠습니다
                  </button>
                  <button onClick={() => setShowNote(v => !v)} disabled={sending}
                    className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 transition-colors">
                    처리했습니다
                  </button>
                  {showNote && (
                    <div className="space-y-2 pt-1">
                      <textarea value={doneNote} onChange={e => setDoneNote(e.target.value)}
                        placeholder="처리 내용을 간단히 입력하세요 (선택)" rows={3}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
                      <button onClick={() => handleComplete(doneNote)}
                        className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">
                        완료 확인
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 text-center">전화 등으로 이미 처리하셨으면 '처리했습니다'를 눌러주세요</p>
                </div>
              )}

              {myReceipt.status === 'processing' && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <button onClick={() => setShowNote(v => !v)}
                    className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-colors">
                    처리했습니다
                  </button>
                  {showNote && (
                    <div className="space-y-2 pt-1">
                      <textarea value={doneNote} onChange={e => setDoneNote(e.target.value)}
                        placeholder="처리 내용을 간단히 입력하세요 (선택)" rows={3}
                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
                      <button onClick={() => handleComplete(doneNote)}
                        className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700">
                        완료 확인
                      </button>
                    </div>
                  )}
                </div>
              )}

              {myReceipt.status === 'done' && (
                <button onClick={handleHide}
                  className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-400 rounded-xl py-2.5 text-sm hover:bg-gray-50 transition-colors">
                  <EyeOff size={14}/> 목록에서 숨기기
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── 본부 화면 ── */}
        {isHQ && !isDirect && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5 space-y-4">
              {/* 진행바 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">{total}곳 발송</span>
                  <span className="text-xs text-gray-500">완료 {doneCount} · 처리중 {procCount} · 미접수 {pendCount}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                  <div className="bg-green-400 h-full transition-all" style={{ width: total ? `${(doneCount/total)*100}%` : '0%' }}/>
                  <div className="bg-blue-400 h-full transition-all"  style={{ width: total ? `${(procCount/total)*100}%` : '0%' }}/>
                  <div className="bg-red-300 h-full transition-all"   style={{ width: total ? `${(pendCount/total)*100}%` : '0%' }}/>
                </div>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"/>완료 {doneCount}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"/>처리중 {procCount}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-300 inline-block"/>미접수 {pendCount}</span>
                </div>
              </div>

              {/* 사업장별 목록 토글 */}
              <button onClick={() => setBizExpanded(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <span className="text-sm font-medium text-gray-700">사업장별 상세 현황</span>
                {bizExpanded ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
              </button>

              {bizExpanded && (
                <div className="space-y-2">
                  {/* 미접수 먼저, 처리중, 완료 순 */}
                  {[...receipts].sort((a,b) => {
                    const order = { pending:0, processing:1, done:2 }
                    return order[a.status] - order[b.status]
                  }).map(r => (
                    <div key={r.bizId} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
                      {statusIcon(r)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{r.bizName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {r.status === 'done'       ? `완료 · ${r.doneAt ? new Date(r.doneAt).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : ''}` :
                           r.status === 'processing' ? `처리중 · ${r.processedAt ? new Date(r.processedAt).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : ''}` :
                           '아직 접수 안 함'}
                        </p>
                        {r.doneNote && <p className="text-xs text-gray-600 mt-1 bg-white rounded-lg px-2 py-1">{r.doneNote}</p>}
                      </div>
                      {statusBadge(r)}
                    </div>
                  ))}
                </div>
              )}

              {/* 본부 완결/재오픈 */}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                {!isDone
                  ? <button onClick={handleClose} className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors">
                      <CheckSquare size={15}/> 완결 처리
                    </button>
                  : <button onClick={handleReopen} className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors">
                      <RotateCcw size={15}/> 재오픈
                    </button>
                }
              </div>
            </div>
          </div>
        )}

        {/* ── 1:1 Direct ── */}
        {isDirect && (
          <div className="bg-white border border-blue-100 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-blue-500"/>
              <h3 className="font-semibold text-gray-900 text-sm">대화</h3>
            </div>
            <div className="space-y-3">
              {[{ uid: message.authorUid, name: message.authorName, body: message.body, createdAt: '' }, ...replies].map((r, i) => (
                <div key={i} className={clsx('flex gap-2', r.uid === user?.uid ? 'flex-row-reverse' : '')}>
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                    {r.name?.[0]}
                  </div>
                  <div className={clsx('max-w-[75%] flex flex-col gap-1', r.uid === user?.uid ? 'items-end' : 'items-start')}>
                    <span className="text-xs text-gray-400">{r.name}</span>
                    <div className={clsx('rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                      r.uid === user?.uid ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm')}>
                      {r.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!isDone && (
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                  placeholder="답변 입력..." rows={2}
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
                <button onClick={handleDirectReply} disabled={!replyText.trim() || sending}
                  className="bg-primary-600 text-white rounded-xl px-4 flex items-center gap-1.5 text-sm font-medium hover:bg-primary-800 disabled:opacity-50 shrink-0">
                  <Send size={14}/>{sending ? '...' : '전송'}
                </button>
              </div>
            )}
            {isHQ && (
              <div className="pt-1 border-t border-gray-100">
                {!isDone
                  ? <button onClick={handleClose} className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800">
                      <CheckSquare size={14}/> 완결 처리
                    </button>
                  : <button onClick={handleReopen} className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600">
                      <RotateCcw size={14}/> 재오픈
                    </button>
                }
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
