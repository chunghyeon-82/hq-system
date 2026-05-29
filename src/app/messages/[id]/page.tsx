'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenMessages, receiveMessage, replyMessage, replyDirect, closeMessage, reopenMessage, hideMessage } from '@/lib/db'
import type { Message } from '@/types'
import {
  CheckCircle2, Clock, AlertCircle, Send, CheckSquare,
  EyeOff, RotateCcw, MessageSquare, Building2, User, Lock
} from 'lucide-react'
import clsx from 'clsx'

export default function MessageDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const { user } = useAuth()
  const router   = useRouter()

  const [message,   setMessage]   = useState<Message | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending,   setSending]   = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'detail'>('overview')

  const isAdmin = user?.role === 'ADMIN'
  const isHQ    = user?.role === 'ADMIN' || user?.role === 'HQ_CHIEF' || user?.role === 'HQ_MEMBER'
  const isBiz   = user?.role === 'BIZ_REP'

  useEffect(() => {
    const unsub = listenMessages(msgs => {
      const found = msgs.find(m => m.id === id) ?? null
      setMessage(found ?? null)
    })
    return unsub
  }, [id])

  if (!message) return (
    <AppShell title="메시지 상세" back={isHQ ? '/businesses' : '/dashboard'}>
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">불러오는 중...</div>
    </AppShell>
  )

  const isDirect   = message.type === 'direct'
  const isDone     = message.status === 'done'
  const myReceipt  = isBiz ? message.receipts?.find(r => r.bizId === user?.bizId) : null
  const replies    = message.replies ?? []
  const receipts   = message.receipts ?? []
  const total      = receipts.length
  const replied    = receipts.filter(r => r.status === 'replied').length
  const received   = receipts.filter(r => r.status === 'received').length
  const pending    = receipts.filter(r => r.status === 'pending').length

  // direct 메시지 접근 권한 체크
  const canViewDirect = isAdmin ||
    (isDirect && (message.authorUid === user?.uid || message.targetUid === user?.uid))

  if (isDirect && !canViewDirect) {
    return (
      <AppShell title="메시지 상세" back="/dashboard">
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
          <Lock size={32}/>
          <p className="text-sm">열람 권한이 없습니다</p>
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
  const handleClose  = async () => { await closeMessage(message.id) }
  const handleReopen = async () => { await reopenMessage(message.id) }
  const handleHide   = async () => {
    if (!user?.bizId) return
    await hideMessage(message.id, user.bizId)
    router.push('/dashboard')
  }

  return (
    <AppShell title="메시지 상세" back={isHQ ? '/businesses' : '/dashboard'}>
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">

        {/* 헤더 카드 */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className={clsx(
            'px-4 py-2.5 flex items-center gap-2 text-sm font-medium',
            isDone ? 'bg-slate-100 text-slate-600' : isDirect ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
          )}>
            {isDirect
              ? <><Lock size={14}/> 1:1 메시지 (비공개)</>
              : isDone
              ? <><CheckCircle2 size={16}/> 완결된 전달</>
              : <><Clock size={16}/> 진행중</>
            }
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
              {isDirect && (
                <span className="flex items-center gap-1">→ {message.targetName}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Direct 메시지 처리 ── */}
        {isDirect && (
          <div className="bg-white border border-blue-100 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-blue-500"/>
              <h3 className="font-semibold text-gray-900 text-sm">대화</h3>
              <span className="text-xs text-gray-400 ml-1 flex items-center gap-1"><Lock size={10}/>비공개</span>
            </div>

            {/* 대화 목록 */}
            <div className="space-y-3">
              {/* 원본 메시지 */}
              <div className={clsx('flex gap-2', message.authorUid === user?.uid ? 'flex-row-reverse' : '')}>
                <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                  {message.authorName?.[0]}
                </div>
                <div className={clsx('max-w-[75%]', message.authorUid === user?.uid ? 'items-end' : 'items-start', 'flex flex-col gap-1')}>
                  <span className="text-xs text-gray-400">{message.authorName}</span>
                  <div className={clsx(
                    'rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                    message.authorUid === user?.uid
                      ? 'bg-primary-600 text-white rounded-tr-sm'
                      : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                  )}>
                    {message.body}
                  </div>
                </div>
              </div>

              {/* 답변들 */}
              {replies.map(reply => (
                <div key={reply.id} className={clsx('flex gap-2', reply.authorUid === user?.uid ? 'flex-row-reverse' : '')}>
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">
                    {reply.authorName?.[0]}
                  </div>
                  <div className={clsx('max-w-[75%]', reply.authorUid === user?.uid ? 'items-end' : 'items-start', 'flex flex-col gap-1')}>
                    <span className="text-xs text-gray-400">
                      {reply.authorName} · {reply.createdAt ? new Date(reply.createdAt).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''}
                    </span>
                    <div className={clsx(
                      'rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                      reply.authorUid === user?.uid
                        ? 'bg-primary-600 text-white rounded-tr-sm'
                        : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    )}>
                      {reply.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 답변 입력 */}
            {!isDone && (
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                  placeholder="답변을 입력하세요..."
                  rows={2}
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
                <button onClick={handleReply} disabled={!replyText.trim() || sending}
                  className="bg-primary-600 text-white rounded-xl px-4 flex items-center gap-1.5 text-sm font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors shrink-0">
                  <Send size={14}/> {sending ? '...' : '전송'}
                </button>
              </div>
            )}

            {/* 완결 처리 */}
            {isHQ && (
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                {!isDone ? (
                  <button onClick={handleClose}
                    className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
                    <CheckSquare size={14}/> 완결 처리
                  </button>
                ) : (
                  <button onClick={handleReopen}
                    className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors">
                    <RotateCcw size={14}/> 재오픈
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Broadcast 본부 화면 ── */}
        {!isDirect && isHQ && (
          <>
            <div className="flex border-b border-gray-200 bg-white rounded-t-xl overflow-hidden">
              {(['overview', 'detail'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={clsx(
                    'flex-1 py-3 text-sm font-medium transition-colors',
                    activeTab === tab
                      ? 'text-primary-700 border-b-2 border-primary-600 bg-white'
                      : 'text-gray-500 hover:text-gray-700'
                  )}>
                  {tab === 'overview' ? '📊 진행 현황' : '📋 사업장별 답변'}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && (
              <div className="bg-white border border-gray-200 rounded-b-xl rounded-tr-xl p-5 space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>전체 진행률</span>
                    <span className="font-medium">{replied}/{total} 완료</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="bg-green-400 h-full transition-all" style={{ width: total ? `${(replied/total)*100}%` : '0%' }}/>
                    <div className="bg-blue-300 h-full transition-all" style={{ width: total ? `${(received/total)*100}%` : '0%' }}/>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: '답변완료', value: replied,  bg: 'bg-green-50', color: 'text-green-600', dot: 'bg-green-400' },
                    { label: '접수확인', value: received, bg: 'bg-blue-50',  color: 'text-blue-600',  dot: 'bg-blue-400' },
                    { label: '미접수',   value: pending,  bg: pending > 0 ? 'bg-red-50' : 'bg-gray-50', color: pending > 0 ? 'text-red-600' : 'text-gray-400', dot: pending > 0 ? 'bg-red-400' : 'bg-gray-300' },
                  ].map(s => (
                    <div key={s.label} className={clsx('rounded-xl p-3 text-center', s.bg)}>
                      <div className={clsx('w-2 h-2 rounded-full mx-auto mb-1', s.dot)}/>
                      <p className={clsx('text-xl font-bold', s.color)}>{s.value}</p>
                      <p className="text-xs text-gray-600">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  {!isDone
                    ? <button onClick={handleClose} className="flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"><CheckSquare size={15}/> 완결 처리</button>
                    : <button onClick={handleReopen} className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"><RotateCcw size={15}/> 재오픈</button>
                  }
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
                          receipt.status === 'replied'  ? 'badge-replied' :
                          receipt.status === 'received' ? 'badge-received' : 'badge-pending'
                        )}>
                          {receipt.status === 'replied' ? '✓ 답변완료' :
                           receipt.status === 'received' ? '● 접수확인' : '○ 미접수'}
                        </span>
                      </div>
                      {bizReplies.length > 0 ? (
                        <div className="ml-9 space-y-2">
                          {bizReplies.map(reply => (
                            <div key={reply.id} className="bg-primary-50 border border-primary-100 rounded-xl p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-5 h-5 rounded-full bg-primary-200 flex items-center justify-center text-xs font-bold text-primary-700">
                                  {reply.authorName?.[0]}
                                </div>
                                <span className="text-xs font-medium text-primary-800">{reply.authorName}</span>
                                <span className="text-xs text-gray-400 ml-auto">
                                  {reply.createdAt ? new Date(reply.createdAt).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''}
                                </span>
                              </div>
                              <p className="text-sm text-gray-800 whitespace-pre-wrap">{reply.body}</p>
                            </div>
                          ))}
                        </div>
                      ) : receipt.status !== 'pending' && (
                        <p className="ml-9 text-xs text-gray-400 italic">답변 내용 없음</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── Broadcast 사업장 화면 ── */}
        {!isDirect && isBiz && myReceipt && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare size={16} className="text-primary-500"/> 처리하기
            </h3>
            <div className={clsx(
              'flex items-center gap-3 p-3 rounded-xl border',
              myReceipt.status === 'replied'  ? 'bg-green-50 border-green-200' :
              myReceipt.status === 'received' ? 'bg-blue-50 border-blue-200'  : 'bg-gray-50 border-gray-200'
            )}>
              <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                myReceipt.status === 'replied'  ? 'bg-green-100' :
                myReceipt.status === 'received' ? 'bg-blue-100'  : 'bg-gray-100')}>
                {myReceipt.status === 'replied'  ? <CheckCircle2 size={16} className="text-green-600"/> :
                 myReceipt.status === 'received' ? <Clock size={16} className="text-blue-600"/> :
                                                   <AlertCircle size={16} className="text-gray-400"/>}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {myReceipt.status === 'replied'  ? '답변 완료' :
                   myReceipt.status === 'received' ? '접수 확인됨' : '아직 확인하지 않음'}
                </p>
              </div>
            </div>
            {myReceipt.status === 'pending' && (
              <button onClick={handleReceive}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-3 font-medium text-sm hover:bg-blue-700 transition-colors">
                <CheckCircle2 size={16}/> 접수 확인하기
              </button>
            )}
            {replies.filter(r => r.bizId === user?.bizId).map(reply => (
              <div key={reply.id} className="bg-primary-50 border border-primary-200 rounded-xl p-3">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{reply.body}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {reply.createdAt ? new Date(reply.createdAt).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''}
                </p>
              </div>
            ))}
            {!isDone && (
              <div className="space-y-2">
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                  placeholder="답변 내용을 입력하세요..." rows={4}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
                <button onClick={handleReply} disabled={!replyText.trim() || sending}
                  className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white rounded-xl py-3 font-medium text-sm hover:bg-primary-800 disabled:opacity-50 transition-colors">
                  <Send size={15}/> {sending ? '전송 중...' : '답변 전송'}
                </button>
              </div>
            )}
            {isDone && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <p className="text-sm text-slate-500">본부에서 완결 처리한 전달입니다</p>
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
    </AppShell>
  )
}
