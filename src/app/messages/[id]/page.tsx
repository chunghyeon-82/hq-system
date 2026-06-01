'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenMessages, receiveMessage, replyMessage, replyDirect, closeMessage, reopenMessage, hideMessage, addEventToMyCalendar, addEvent } from '@/lib/db'
import type { Message } from '@/types'
import {
  CheckCircle2, Clock, AlertCircle, Send, CheckSquare,
  EyeOff, RotateCcw, MessageSquare, Building2, User, Lock,
  Calendar, Link2, Bell, ExternalLink
} from 'lucide-react'
import clsx from 'clsx'

export default function MessageDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const { user } = useAuth()
  const router   = useRouter()

  const [message,   setMessage]   = useState<Message | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending,   setSending]   = useState(false)
  const [closing,   setClosing]   = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'detail'>('overview')
  const [addedCal,  setAddedCal]  = useState(false)

  const isAdmin = user?.role === 'ADMIN'
  const isHQ    = user?.role === 'ADMIN' || user?.role === 'HQ_CHIEF' || user?.role === 'HQ_MEMBER'
  const isBiz   = user?.role === 'BIZ_REP'

  useEffect(() => {
    return listenMessages(msgs => setMessage(msgs.find(m => m.id === id) ?? null))
  }, [id])

  if (!message) return (
    <AppShell title="메시지 상세" back={isHQ ? '/businesses' : '/dashboard'}>
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">불러오는 중...</div>
    </AppShell>
  )

  const isDirect  = message.type === 'direct'
  const isDone    = message.status === 'done'
  const myReceipt = isBiz ? message.receipts?.find(r => r.bizId === user?.bizId) : null
  const replies   = message.replies ?? []
  const receipts  = message.receipts ?? []
  const myReplies = isBiz ? replies.filter(r => r.bizId === user?.bizId) : []

  const total    = receipts.length
  const replied  = receipts.filter(r => r.status === 'replied').length
  const received = receipts.filter(r => r.status === 'received').length
  const pending  = receipts.filter(r => r.status === 'pending').length

  if (isDirect && !isAdmin && message.authorUid !== user?.uid && message.targetUid !== user?.uid) {
    return (
      <AppShell title="메시지 상세" back="/dashboard">
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
          <Lock size={32}/><p className="text-sm">열람 권한이 없습니다</p>
        </div>
      </AppShell>
    )
  }

  const handleReceive = async () => {
    if (!user?.bizId || myReceipt?.status !== 'pending') return
    await receiveMessage(message.id, user.bizId)
  }

  const handleReply = async () => {
    if (!replyText.trim()) return
    setSending(true)
    if (isDirect) {
      await replyDirect(message.id, user!.uid, user!.name, replyText.trim())
    } else if (user?.bizId) {
      await replyMessage(message.id, user.bizId,
        message.receipts.find(r => r.bizId === user.bizId)?.bizName ?? '',
        user.uid, user.name, replyText.trim())
    }
    setReplyText('')
    setSending(false)
  }

  const handleClose  = async () => { setClosing(true); await closeMessage(message.id);  setClosing(false) }
  const handleReopen = async () => { await reopenMessage(message.id) }
  const handleHide   = async () => {
    if (!user?.bizId) return
    await hideMessage(message.id, user.bizId)
    router.push('/dashboard')
  }

  // 캘린더 추가
  const handleAddToCalendar = async () => {
    if (!user || !message.eventDate) return
    if (isBiz && user.bizId) {
      await addEventToMyCalendar(message.id, user.bizId)
    } else {
      await addEvent({
        title:    message.eventTitle || message.title,
        date:     message.eventDate,
        time:     message.eventTime,
        ownerUid: user.uid,
        ownerName: user.name,
        isDone:   false,
      })
    }
    setAddedCal(true)
  }

  // 첨부 정보 표시
  const hasEvent = !!message.eventDate
  const hasLink  = !!message.linkUrl

  return (
    <AppShell title="메시지 상세" back={isHQ ? '/businesses' : '/dashboard'}>
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">

        {/* 메시지 헤더 */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className={clsx(
            'px-4 py-2.5 flex items-center gap-2 text-sm font-medium',
            isDone   ? 'bg-slate-100 text-slate-600' :
            isDirect ? 'bg-blue-50 text-blue-700'    :
                       'bg-amber-50 text-amber-700'
          )}>
            {isDirect  ? <><Lock size={14}/> 1:1 메시지 (비공개)</> :
             isDone    ? <><CheckCircle2 size={16}/> 완결</> :
                         <><Clock size={16}/> 진행중</>}
            {message.priority === 'urgent' && (
              <span className="ml-auto badge-urgent flex items-center gap-1">
                <AlertCircle size={12}/> 긴급
              </span>
            )}
          </div>
          <div className="p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3">{message.title}</h2>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {message.body}
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><User size={12}/>{message.authorName}</span>
              {isDirect && <span>→ {message.targetName}</span>}
            </div>

            {/* 일정 첨부 */}
            {hasEvent && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-blue-500"/>
                  <div>
                    <p className="text-xs font-semibold text-blue-800">{message.eventTitle || message.title}</p>
                    <p className="text-xs text-blue-600">
                      {message.eventDate}{message.eventTime ? ` ${message.eventTime}` : ''}
                    </p>
                  </div>
                </div>
                {!addedCal ? (
                  <button onClick={handleAddToCalendar}
                    className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
                    <Bell size={11}/> 캘린더에 추가
                  </button>
                ) : (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 size={11}/> 추가됨
                  </span>
                )}
              </div>
            )}

            {/* 링크 첨부 */}
            {hasLink && (
              <a href={message.linkUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 hover:bg-green-100 transition-colors">
                <Link2 size={15} className="text-green-600 shrink-0"/>
                <span className="text-xs text-green-800 flex-1 truncate">
                  {message.linkLabel || message.linkUrl}
                </span>
                <ExternalLink size={12} className="text-green-500 shrink-0"/>
              </a>
            )}
          </div>
        </div>

        {/* 사업장 대표 화면 */}
        {isBiz && !isDirect && myReceipt && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {myReceipt.status === 'pending' && (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                  <AlertCircle size={20} className="text-red-500 shrink-0"/>
                  <div>
                    <p className="text-sm font-semibold text-red-800">아직 접수하지 않은 메시지입니다</p>
                    <p className="text-xs text-red-600 mt-0.5">접수 확인 버튼을 눌러 수신을 알려주세요</p>
                  </div>
                </div>
                <button onClick={handleReceive}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-3.5 font-semibold text-sm hover:bg-blue-700 transition-colors">
                  <CheckCircle2 size={17}/> 접수 확인하기
                </button>
              </div>
            )}
            {myReceipt.status !== 'pending' && (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <CheckCircle2 size={16} className="text-blue-500 shrink-0"/>
                  <div>
                    <p className="text-xs font-semibold text-blue-800">접수 확인 완료</p>
                    {myReceipt.receivedAt && (
                      <p className="text-xs text-blue-600">
                        {new Date(myReceipt.receivedAt).toLocaleDateString('ko-KR', {
                          year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
                        })}
                      </p>
                    )}
                  </div>
                </div>
                {myReplies.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500">진행상황 전송 내역</p>
                    {myReplies.map(reply => (
                      <div key={reply.id} className="bg-primary-50 border border-primary-100 rounded-xl p-3">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{reply.body}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          {reply.createdAt ? new Date(reply.createdAt).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {!isDone && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-700">진행상황 전송</p>
                    <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                      placeholder="진행 내용을 입력하세요..." rows={4}
                      className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
                    <button onClick={handleReply} disabled={!replyText.trim() || sending}
                      className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white rounded-xl py-3 font-medium text-sm hover:bg-primary-800 disabled:opacity-50 transition-colors">
                      <Send size={15}/> {sending ? '전송 중...' : '진행상황 전송'}
                    </button>
                  </div>
                )}
                {isDone && (
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <CheckSquare size={16} className="text-slate-500 shrink-0"/>
                    <p className="text-sm text-slate-600">본부에서 완결 처리한 메시지입니다</p>
                  </div>
                )}
                {isDone && (
                  <button onClick={handleHide}
                    className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-500 rounded-xl py-2.5 text-sm hover:bg-gray-50 transition-colors">
                    <EyeOff size={14}/> 내 목록에서 숨기기
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 본부 화면 */}
        {isHQ && !isDirect && (
          <>
            <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden">
              {(['overview', 'detail'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={clsx('flex-1 py-3 text-sm font-medium transition-colors',
                    activeTab === tab ? 'text-primary-700 border-b-2 border-primary-600 bg-white' : 'text-gray-500 hover:text-gray-700')}>
                  {tab === 'overview' ? '📊 진행 현황' : '📋 사업장별 답변'}
                </button>
              ))}
            </div>
            {activeTab === 'overview' && (
              <div className="bg-white border border-gray-200 rounded-b-xl rounded-tr-xl p-5 space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>전체 진행률</span><span className="font-medium">{replied}/{total} 완료</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="bg-green-400 h-full transition-all" style={{ width: total ? `${(replied/total)*100}%` : '0%' }}/>
                    <div className="bg-blue-300 h-full transition-all" style={{ width: total ? `${(received/total)*100}%` : '0%' }}/>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label:'미접수',   value:pending,  bg:pending>0?'bg-red-50':'bg-gray-50',   color:pending>0?'text-red-600':'text-gray-400',   dot:pending>0?'bg-red-400':'bg-gray-300' },
                    { label:'진행중',   value:received, bg:'bg-blue-50',  color:'text-blue-600',  dot:'bg-blue-400'  },
                    { label:'답변완료', value:replied,  bg:'bg-green-50', color:'text-green-600', dot:'bg-green-400' },
                  ].map(s => (
                    <div key={s.label} className={clsx('rounded-xl p-3 text-center', s.bg)}>
                      <div className={clsx('w-2 h-2 rounded-full mx-auto mb-1', s.dot)}/>
                      <p className={clsx('text-xl font-bold', s.color)}>{s.value}</p>
                      <p className="text-xs text-gray-600">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  {!isDone ? (
                    <button onClick={handleClose} disabled={closing}
                      className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-60 transition-colors">
                      <CheckSquare size={15}/> {closing ? '처리 중...' : '완결 처리'}
                    </button>
                  ) : (
                    <button onClick={handleReopen}
                      className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors">
                      <RotateCcw size={15}/> 재오픈
                    </button>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'detail' && (
              <div className="bg-white border border-gray-200 rounded-b-xl rounded-tr-xl divide-y divide-gray-100">
                {receipts.map(receipt => {
                  const bizReplies = replies.filter(r => r.bizId === receipt.bizId)
                  return (
                    <div key={receipt.bizId} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center">
                            <Building2 size={13} className="text-primary-600"/>
                          </div>
                          <span className="font-medium text-sm text-gray-900">{receipt.bizName}</span>
                        </div>
                        <span className={clsx(
                          receipt.status==='replied' ? 'badge-replied' :
                          receipt.status==='received' ? 'badge-received' : 'badge-pending')}>
                          {receipt.status==='replied'?'✓ 답변완료':receipt.status==='received'?'● 진행중':'○ 미접수'}
                        </span>
                      </div>
                      {bizReplies.map(reply => (
                        <div key={reply.id} className="ml-9 mt-2 bg-primary-50 border border-primary-100 rounded-xl p-3">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{reply.body}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {reply.authorName} · {reply.createdAt ? new Date(reply.createdAt).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* 1:1 Direct 채팅 */}
        {isDirect && (
          <div className="bg-white border border-blue-100 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-blue-500"/>
              <h3 className="font-semibold text-gray-900 text-sm">대화</h3>
              <span className="text-xs text-gray-400 flex items-center gap-1 ml-1"><Lock size={10}/>비공개</span>
            </div>
            <div className="space-y-3">
              <div className={clsx('flex gap-2', message.authorUid===user?.uid ? 'flex-row-reverse' : '')}>
                <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                  {message.authorName?.[0]}
                </div>
                <div className={clsx('max-w-[75%] flex flex-col gap-1', message.authorUid===user?.uid ? 'items-end' : 'items-start')}>
                  <span className="text-xs text-gray-400">{message.authorName}</span>
                  <div className={clsx('rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                    message.authorUid===user?.uid ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm')}>
                    {message.body}
                  </div>
                </div>
              </div>
              {replies.map(reply => (
                <div key={reply.id} className={clsx('flex gap-2', reply.authorUid===user?.uid ? 'flex-row-reverse' : '')}>
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                    {reply.authorName?.[0]}
                  </div>
                  <div className={clsx('max-w-[75%] flex flex-col gap-1', reply.authorUid===user?.uid ? 'items-end' : 'items-start')}>
                    <span className="text-xs text-gray-400">{reply.authorName}</span>
                    <div className={clsx('rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                      reply.authorUid===user?.uid ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm')}>
                      {reply.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!isDone && (
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                  placeholder="답변을 입력하세요..." rows={2}
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
                <button onClick={handleReply} disabled={!replyText.trim()||sending}
                  className="bg-primary-600 text-white rounded-xl px-4 flex items-center gap-1.5 text-sm font-medium hover:bg-primary-800 disabled:opacity-50 shrink-0">
                  <Send size={14}/> {sending?'...':'전송'}
                </button>
              </div>
            )}
            {isHQ && (
              <div className="flex gap-2 pt-1 border-t border-gray-100">
                {!isDone
                  ? <button onClick={handleClose} disabled={closing}
                      className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
                      <CheckSquare size={14}/> {closing?'처리 중...':'완결 처리'}
                    </button>
                  : <button onClick={handleReopen}
                      className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600">
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
