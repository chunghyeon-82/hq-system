'use client'
// src/app/businesses/[id]/page.tsx
import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import BusinessForm from '@/components/BusinessForm'
import { useAuth } from '@/lib/auth-context'
import { getBusiness, listenMessages, markReceived, addReply, deleteBusiness, hideMessage, listenBusinesses } from '@/lib/db'
import type { Business, Message } from '@/types'
import { Edit, Trash2, ChevronLeft, CheckCircle2, MessageSquare, SendHorizonal, EyeOff, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import clsx from 'clsx'
import Link from 'next/link'

export default function BusinessDetailPage() {
  const { id }       = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router       = useRouter()
  const { user }     = useAuth()

  const [biz,        setBiz]        = useState<Business | null>(null)
  const [allBiz,     setAllBiz]     = useState<Business[]>([])
  const [messages,   setMessages]   = useState<Message[]>([])
  const [tab,        setTab]        = useState<'info' | 'messages' | 'inter'>('info')
  const [editing,    setEditing]    = useState(false)
  const [selMsg,     setSelMsg]     = useState<Message | null>(null)
  const [replyTxt,   setReplyTxt]   = useState('')
  const [sending,    setSending]    = useState(false)
  const [filter,     setFilter]     = useState<'all' | 'pending' | 'done'>('all')

  // 사업장 간 메시지
  const [interTitle, setInterTitle] = useState('')
  const [interBody,  setInterBody]  = useState('')
  const [interTo,    setInterTo]    = useState('')
  const [interSending, setInterSending] = useState(false)
  const [interSent,  setInterSent]  = useState(false)

  const isAdmin  = user?.role === 'ADMIN'
  const isHQ     = user?.role === 'HQ_CHIEF' || user?.role === 'HQ_MEMBER'
  const isBizRep = user?.role === 'BIZ_REP'
  const canManage = isAdmin

  useEffect(() => {
    getBusiness(id).then(setBiz)
    const u1 = listenMessages(id, setMessages)
    const u2 = listenBusinesses(setAllBiz)
    return () => { u1(); u2() }
  }, [id])

  useEffect(() => {
    const msgId = searchParams.get('msg')
    if (msgId && messages.length) {
      const m = messages.find(x => x.id === msgId)
      if (m) { setTab('messages'); setSelMsg(m) }
    }
  }, [searchParams, messages])

  if (!biz) return <AppShell><div className="p-6 text-sm text-gray-400">로딩 중...</div></AppShell>

  const relTime = (iso: string) => {
    try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ko }) } catch { return iso }
  }

  const pendingCnt = messages.filter(
    m => m.receipts.find(r => r.bizId === id)?.status === 'pending'
  ).length

  // 숨겨지지 않은 메시지만 표시 (사업장대표 입장)
  const visibleMsgs = messages.filter(m => {
    const r = m.receipts.find(x => x.bizId === id)
    if (isBizRep && r?.hidden) return false
    return true
  })

  const filteredMsgs = visibleMsgs.filter(m => {
    const r = m.receipts.find(x => x.bizId === id)
    if (filter === 'pending') return r?.status === 'pending'
    if (filter === 'done')    return r?.status !== 'pending'
    return true
  })

  // 사업장 간 메시지 (내가 받은 것)
  const interMsgs = messages.filter(m => m.fromBizId && m.fromBizId !== id)

  const handleReceive = async (msgId: string) => {
    await markReceived(msgId, id, biz.name)
  }

  const handleHide = async (msgId: string) => {
    if (!confirm('이 메시지를 숨기시겠습니까? 본부 기록에는 남아있습니다.')) return
    await hideMessage(msgId, id)
    setSelMsg(null)
  }

  const handleReply = async () => {
    if (!replyTxt.trim() || !selMsg || !user) return
    setSending(true)
    await addReply(selMsg.id, id, {
      fromUid: user.uid, fromName: user.name, role: user.role,
      text: replyTxt, createdAt: new Date().toISOString(),
    })
    setReplyTxt('')
    setSending(false)
  }

  const handleInterSend = async () => {
    if (!interTitle.trim() || !interBody.trim() || !interTo || !user) return
    setInterSending(true)
    const { sendMessage } = await import('@/lib/db')
    const targetBiz = allBiz.find(b => b.id === interTo)
    await sendMessage({
      title: interTitle.trim(),
      body: interBody.trim(),
      priority: 'normal',
      fromUid: user.uid,
      fromName: user.name,
      fromRole: user.role,
      fromBizId: id,
      targetBizIds: [interTo],
      receipts: [{ bizId: interTo, bizName: targetBiz?.name ?? interTo, status: 'pending' }],
    })
    setInterTitle(''); setInterBody(''); setInterTo('')
    setInterSending(false); setInterSent(true)
    setTimeout(() => setInterSent(false), 3000)
  }

  const handleDelete = async () => {
    if (!confirm(`"${biz.name}"을 삭제하시겠습니까?`)) return
    await deleteBusiness(id)
    router.replace('/businesses')
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link href="/businesses" className="p-1 text-gray-400 hover:text-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{biz.name}</h1>
              <p className="text-sm text-gray-500">{biz.repName} 대표 · {biz.address}</p>
            </div>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <button onClick={() => setEditing(true)} className="btn">
                <Edit className="w-4 h-4" /> 수정
              </button>
              <button onClick={handleDelete} className="btn btn-danger">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-100 mb-5">
          {(['info', 'messages', ...(isBizRep ? ['inter'] : [])] as const).map(t => (
            <button key={t} onClick={() => { setTab(t as typeof tab); setSelMsg(null) }}
              className={clsx(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              )}>
              {t === 'info' ? '기본정보' : t === 'messages' ? (
                <span className="flex items-center gap-1.5">
                  전달/지시사항
                  {pendingCnt > 0 && <span className="text-[10px] font-bold bg-red-100 text-red-700 rounded-full px-1.5 py-0.5">{pendingCnt}</span>}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> 사업장 간 메시지
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 기본정보 탭 */}
        {tab === 'info' && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: '사업장명', value: biz.name },
                { label: '대표자',   value: biz.repName },
                { label: '연락처',   value: biz.repPhone },
                { label: '직원 수',  value: `${biz.employees}명` },
                { label: '설립일',   value: biz.established },
                { label: '업종',     value: biz.businessType },
              ].map(({ label, value }) => (
                <div key={label} className="card p-3.5">
                  <div className="text-[11px] text-gray-400 mb-1">{label}</div>
                  <div className="text-sm font-medium text-gray-900">{value || '-'}</div>
                </div>
              ))}
              <div className="card p-3.5 col-span-2 md:col-span-3">
                <div className="text-[11px] text-gray-400 mb-1">주소</div>
                <div className="text-sm font-medium text-gray-900">{biz.address || '-'}</div>
              </div>
            </div>
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">주주명부</div>
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="text-left px-4 py-2">주주명</th><th className="text-right px-4 py-2">주식수</th><th className="text-right px-4 py-2">지분율</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {biz.shareholders.map((s, i) => (
                    <tr key={i}><td className="px-4 py-2.5 text-gray-900">{s.name}</td><td className="px-4 py-2.5 text-right text-gray-700">{s.shares.toLocaleString()}주</td><td className="px-4 py-2.5 text-right text-gray-700">{s.pct}%</td></tr>
                  ))}
                  {biz.shareholders.length === 0 && <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-400 text-xs">데이터 없음</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">임원정보</div>
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="text-left px-4 py-2">성명</th><th className="text-left px-4 py-2">직책</th><th className="text-left px-4 py-2">임기시작</th><th className="text-left px-4 py-2">임기만료</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {biz.officers.map((o, i) => {
                    const expired = o.termEnd && new Date(o.termEnd) < new Date()
                    return (
                      <tr key={i}>
                        <td className="px-4 py-2.5 text-gray-900">{o.name}</td>
                        <td className="px-4 py-2.5 text-gray-700">{o.title}</td>
                        <td className="px-4 py-2.5 text-gray-500">{o.termStart}</td>
                        <td className={clsx('px-4 py-2.5', expired ? 'text-red-600 font-medium' : 'text-gray-500')}>
                          {o.termEnd}{expired && <span className="ml-1 text-[10px] bg-red-50 text-red-600 rounded px-1">만료</span>}
                        </td>
                      </tr>
                    )
                  })}
                  {biz.officers.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-400 text-xs">데이터 없음</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 전달/지시사항 탭 */}
        {tab === 'messages' && !selMsg && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5">
              {([['all', '전체'], ['pending', '미접수'], ['done', '처리완료']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setFilter(v)}
                  className={clsx('btn text-xs', filter === v && 'bg-primary-50 text-primary-700 border-primary-200')}>{l}</button>
              ))}
              {(isHQ || isAdmin) && (
                <Link href={`/compose?biz=${id}`} className="btn btn-primary text-xs ml-auto">+ 전달 작성</Link>
              )}
            </div>
            <div className="card overflow-hidden">
              {filteredMsgs.length === 0
                ? <div className="py-12 text-center text-sm text-gray-400">전달사항이 없습니다</div>
                : <ul className="divide-y divide-gray-50">
                    {filteredMsgs.map(m => {
                      const receipt = m.receipts.find(r => r.bizId === id)
                      const replyCnt = m.replies.length
                      return (
                        <li key={m.id} onClick={() => setSelMsg(m)}
                          className="flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className={m.priority === 'urgent' ? 'badge-urgent' : 'badge-normal'}>
                                {m.priority === 'urgent' ? '긴급' : '일반'}
                              </span>
                              {receipt && (
                                <span className={clsx(
                                  receipt.status === 'pending' ? 'badge-pending' :
                                  receipt.status === 'received' ? 'badge-received' : 'badge-replied'
                                )}>
                                  {receipt.status === 'pending' ? '미접수' : receipt.status === 'received' ? '접수확인' : '답변완료'}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-900 truncate">{m.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{m.fromName} · {relTime(m.createdAt)}</p>
                          </div>
                          {replyCnt > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-gray-400 flex-shrink-0">
                              <MessageSquare className="w-3.5 h-3.5" /> {replyCnt}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
              }
            </div>
          </div>
        )}

        {/* 메시지 상세 */}
        {tab === 'messages' && selMsg && (
          <div>
            <button onClick={() => setSelMsg(null)} className="btn text-xs mb-4">
              <ChevronLeft className="w-4 h-4" /> 목록으로
            </button>
            <div className="flex flex-col gap-4">
              <div className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 mb-1">{selMsg.title}</h2>
                    <div className="text-xs text-gray-400">{selMsg.fromName} · {selMsg.createdAt.slice(0, 16).replace('T', ' ')}</div>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <span className={selMsg.priority === 'urgent' ? 'badge-urgent' : 'badge-normal'}>
                      {selMsg.priority === 'urgent' ? '긴급' : '일반'}
                    </span>
                    {isBizRep && (
                      <button onClick={() => handleHide(selMsg.id)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg px-2 py-1 transition-colors">
                        <EyeOff className="w-3.5 h-3.5" /> 숨기기
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selMsg.body}</p>
              </div>

              {isBizRep && selMsg.receipts.find(r => r.bizId === id)?.status === 'pending' && (
                <button onClick={() => handleReceive(selMsg.id)} className="btn btn-primary w-full justify-center gap-2 py-2.5">
                  <CheckCircle2 className="w-4 h-4" /> 접수 확인
                </button>
              )}

              {selMsg.replies.length > 0 && (
                <div className="card p-4 flex flex-col gap-3">
                  <div className="text-xs font-semibold text-gray-500">대화</div>
                  {selMsg.replies.map(r => (
                    <div key={r.id} className="flex items-start gap-2.5">
                      <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0',
                        r.role === 'BIZ_REP' ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-700')}>
                        {r.fromName[0]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-1.5 mb-0.5">
                          <span className="text-xs font-medium text-gray-900">{r.fromName}</span>
                          <span className="text-[10px] text-gray-400">{r.createdAt.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <div className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{r.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="card p-4">
                <div className="text-xs font-semibold text-gray-500 mb-3">
                  {isBizRep ? '답변 작성' : '추가 전달'}
                </div>
                <textarea className="input resize-none min-h-[80px] text-sm" placeholder="내용을 입력하세요..."
                  value={replyTxt} onChange={e => setReplyTxt(e.target.value)} />
                <div className="flex justify-end mt-2">
                  <button onClick={handleReply} disabled={!replyTxt.trim() || sending} className="btn btn-primary gap-2">
                    <SendHorizonal className="w-4 h-4" />{sending ? '전송 중...' : '전송'}
                  </button>
                </div>
              </div>

              {(isHQ || isAdmin) && selMsg.receipts.length > 1 && (
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">접수 현황</div>
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50 text-xs text-gray-500">
                      <th className="text-left px-4 py-2">사업장</th><th className="text-left px-4 py-2">상태</th><th className="text-left px-4 py-2">처리일시</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {selMsg.receipts.map(r => (
                        <tr key={r.bizId}>
                          <td className="px-4 py-2.5 text-gray-900">{r.bizName}</td>
                          <td className="px-4 py-2.5">
                            <span className={clsx(r.status === 'pending' ? 'badge-pending' : r.status === 'received' ? 'badge-received' : 'badge-replied')}>
                              {r.status === 'pending' ? '미접수' : r.status === 'received' ? '접수확인' : '답변완료'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-400 text-xs">{r.repliedAt ?? r.receivedAt ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 사업장 간 메시지 탭 */}
        {tab === 'inter' && (
          <div className="flex flex-col gap-4">
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">다른 사업장에 메시지 보내기</h2>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">받는 사업장</label>
                  <select className="input" value={interTo} onChange={e => setInterTo(e.target.value)}>
                    <option value="">사업장 선택</option>
                    {allBiz.filter(b => b.id !== id).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">제목</label>
                  <input className="input" value={interTitle} onChange={e => setInterTitle(e.target.value)} placeholder="메시지 제목" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">내용</label>
                  <textarea className="input resize-none min-h-[100px] text-sm" value={interBody} onChange={e => setInterBody(e.target.value)} placeholder="메시지 내용을 입력하세요" />
                </div>
                {interSent && <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">✓ 발송되었습니다!</p>}
                <button onClick={handleInterSend} disabled={!interTo || !interTitle.trim() || !interBody.trim() || interSending}
                  className="btn btn-primary w-full justify-center">
                  <SendHorizonal className="w-4 h-4" />{interSending ? '전송 중...' : '메시지 발송'}
                </button>
              </div>
            </div>

            {interMsgs.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">받은 메시지</div>
                <ul className="divide-y divide-gray-50">
                  {interMsgs.map(m => (
                    <li key={m.id} className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{m.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{m.fromName} · {relTime(m.createdAt)}</div>
                      <div className="text-sm text-gray-600 mt-1">{m.body}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {editing && (
          <BusinessForm initial={biz} onClose={() => setEditing(false)}
            onSaved={() => { setEditing(false); getBusiness(id).then(setBiz) }} />
        )}
      </div>
    </AppShell>
  )
}
