'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenApprovalDocs, updateApprovalDoc, listenSavedContacts, saveEmailContact, listenRecipientContacts } from '@/lib/db'
import type { ApprovalDoc, Approver, SavedEmailContact, RecipientContact } from '@/types'
import { CheckCircle2, XCircle, Mail, Upload, Printer, Plus, X, Trash2 } from 'lucide-react'
import clsx from 'clsx'

export default function ApprovalDetailPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [docs,     setDocs]     = useState<ApprovalDoc[]>([])
  const [contacts, setContacts] = useState<SavedEmailContact[]>([])
  const [comment,  setComment]  = useState('')
  const [acting,   setActing]   = useState(false)
  const [showEmail,setShowEmail]= useState(false)
  const [emailTo,  setEmailTo]  = useState<{name:string;email:string}[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [newName,  setNewName]  = useState('')
  const [sending,  setSending]  = useState(false)
  const [recipientContacts, setRecipientContacts] = useState<RecipientContact[]>([])

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    const u1 = listenApprovalDocs(user.uid, setDocs)
    const u2 = listenSavedContacts(user.uid, setContacts)
    const u3 = listenRecipientContacts(user.uid, setRecipientContacts)
    return () => { u1(); u2(); u3() }  // dead code 제거
  }, [user, loading, router])

  const doc = docs.find(d => d.id === id)

  if (loading || !doc) return (
    <AppShell title="발신공문 상세" back="/approval">
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">불러오는 중..</div>
    </AppShell>
  )

  const allApprovers = [doc.drafter, ...doc.approvers, doc.finalApprover]
  const isMyTurn = doc.status === 'pending' && (
    doc.approvers?.some(a => a.uid === user?.uid && a.status === 'waiting' &&
      allApprovers.slice(0, allApprovers.findIndex(x => x.uid === a.uid)).every(x => x.status === 'submitted' || x.status === 'approved')) ||
    (doc.finalApprover?.uid === user?.uid && doc.finalApprover?.status === 'waiting' &&
      doc.approvers.every(a => a.status === 'approved' || a.status === 'submitted'))
  )
  const isAuthor   = doc.authorUid === user?.uid
  const isHQ       = user && ['ADMIN','HQ_CHIEF','HQ_MEMBER'].includes(user.role)
  const isViewer   = doc.viewers?.some(v => v.uid === user?.uid)
  const isApproved = doc.status === 'approved'

  const handleApprove = async () => {
    if (!user || acting) return
    setActing(true)
    const now = new Date().toISOString()
    const sealUrl = (user as typeof user & {sealUrl?:string}).sealUrl
    const newApprovers = doc.approvers.map(a =>
      a.uid === user.uid ? { ...a, status: 'approved' as const, actedAt: now, comment, ...(sealUrl ? { sealUrl } : {}) } : a
    )
    const finalApprover = doc.finalApprover.uid === user.uid
      ? { ...doc.finalApprover, status: 'approved' as const, actedAt: now, comment, ...(sealUrl ? { sealUrl } : {}) }
      : doc.finalApprover

    const allDone = newApprovers.every(a => a.status === 'approved' || a.status === 'submitted')
    const isFinalStep = finalApprover.status === 'approved'

    await updateApprovalDoc(id, {
      approvers: newApprovers,
      finalApprover,
      status: isFinalStep ? 'approved' : 'pending',
      ...(isFinalStep ? { approvedAt: now } : {}),
    })

    if (isFinalStep) {
      fetch('/api/push', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer hq-cleanup-2026'},
        body: JSON.stringify({ title:'새 결재 완료', body:`"${doc.title}" 최종 결재가 완료됐습니다`, url:'/approval', targetUids:[doc.authorUid] }),
      }).catch(()=>{})
    } else if (allDone) {
      fetch('/api/push', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer hq-cleanup-2026'},
        body: JSON.stringify({ title:'새 결재 요청', body:`"${doc.title}" 결재를 요청합니다`, url:'/approval', targetUids:[doc.finalApprover.uid] }),
      }).catch(()=>{})
    }
    setComment(''); setActing(false)
  }

  const handleReject = async () => {
    if (!user || acting || !comment.trim()) { alert('반려 사유를 입력해주세요'); return }
    setActing(true)
    const now = new Date().toISOString()
    const newApprovers = doc.approvers.map(a =>
      a.uid === user.uid ? { ...a, status: 'rejected' as const, actedAt: now, comment } : a
    )
    const finalApprover = doc.finalApprover.uid === user.uid
      ? { ...doc.finalApprover, status: 'rejected' as const, actedAt: now, comment }
      : doc.finalApprover

    await updateApprovalDoc(id, { approvers: newApprovers, finalApprover, status: 'rejected', rejectedAt: now })
    fetch('/api/push', {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer hq-cleanup-2026'},
      body: JSON.stringify({ title:'결재 반려', body:`"${doc.title}" 결재가 반려됐습니다. 사유: ${comment}`, url:'/approval', targetUids:[doc.authorUid] }),
    }).catch(()=>{})
    setComment(''); setActing(false)
  }

  const handleSendEmail = async () => {
    if (!emailTo.length) { alert('수신자를 선택해주세요'); return }
    setSending(true)
    try {
      const res = await fetch('/api/email', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer hq-cleanup-2026'},
        body: JSON.stringify({
          to: emailTo.map(e => e.email),
          subject: `[공문] ${doc.title}`,
          html: `<p><b>${doc.orgName}</b></p><hr/><p><b>수신:</b> ${doc.recipient}</p><p><b>제목:</b> ${doc.title}</p><br/><div>${doc.body.replace(/\n/g,'<br/>')}</div>`,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      await updateApprovalDoc(id, { isSent: true, sentAt: new Date().toISOString() })
      alert('이메일이 발송됐습니다')
      setShowEmail(false)
    } catch(e: unknown) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      alert(`발송 실패: ${msg}`)
    } finally { setSending(false) }
  }

  const addEmailTo = (name: string, email: string, save=false) => {
    if (emailTo.some(e => e.email === email)) return
    setEmailTo(p => [...p, {name, email}])
    if (save && user) saveEmailContact(user.uid, name, email)
    setNewEmail(''); setNewName('')
  }

  const formatDt = (s?: string) => {
    if (!s) return ''
    const d = new Date(s)
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  const STATUS_COLOR: Record<string,string> = {
    draft:'bg-gray-100 text-gray-600', pending:'bg-blue-100 text-blue-700',
    approved:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-700'
  }
  const STATUS_LABEL: Record<string,string> = { draft:'임시저장', pending:'결재중', approved:'결재완료', rejected:'반려' }

  return (
    <AppShell title="발신공문" back="/approval">
      <div className="max-w-4xl mx-auto p-4 space-y-4">

        {/* 상태 + 액션 버튼 */}
        <div className="flex items-center justify-between">
          <span className={clsx('text-sm font-medium px-3 py-1.5 rounded-full', STATUS_COLOR[doc.status])}>
            {STATUS_LABEL[doc.status]}
          </span>
          <div className="flex gap-2">
            {isApproved && isAuthor && (
              <button onClick={() => setShowEmail(v=>!v)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-800">
                <Mail size={15}/> 이메일 발송
              </button>
            )}
            {isHQ && (
              <button onClick={() => router.push(`/approval/new?copyFrom=${id}`)}
                className="flex items-center gap-2 px-4 py-2 border border-primary-200 text-primary-700 rounded-xl text-sm font-medium hover:bg-primary-50 transition-colors">
                이 문서로 새 기안
              </button>
            )}
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
              <Printer size={15}/> 인쇄
            </button>
          </div>
        </div>

        {/* 이메일 발송 패널 */}
        {showEmail && (
          <div className="bg-white border border-primary-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm">이메일 발송</h3>
            <div className="flex flex-wrap gap-2">
              {emailTo.map(e => (
                <div key={e.email} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-full text-xs text-primary-800">
                  {e.name} &lt;{e.email}&gt;
                  <button onClick={() => setEmailTo(p=>p.filter(x=>x.email!==e.email))}><X size={10}/></button>
                </div>
              ))}
            </div>
            {recipientContacts.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">수신자 목록</p>
                <div className="flex flex-wrap gap-2">
                  {recipientContacts.map(c => (
                    <button key={c.id} onClick={() => addEmailTo(c.name, c.email)}
                      disabled={emailTo.some(e=>e.email===c.email)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-green-200 bg-green-50 rounded-full text-xs text-green-700 hover:bg-green-100 disabled:opacity-40">
                      <Plus size={10}/> {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {contacts.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">이전 발송 연락처</p>
                <div className="flex flex-wrap gap-2">
                  {contacts.map(c => (
                    <button key={c.id} onClick={() => addEmailTo(c.name, c.email)}
                      disabled={emailTo.some(e=>e.email===c.email)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-full text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                      <Plus size={10}/> {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="이름"
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="이메일 주소"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              <button onClick={() => addEmailTo(newName||newEmail, newEmail, true)}
                disabled={!newEmail.includes('@')}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-40">
                추가+저장
              </button>
            </div>
            <button onClick={handleSendEmail} disabled={sending || !emailTo.length}
              className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
              {sending ? '발송 중..' : `${emailTo.length}명에게 이메일 발송`}
            </button>
          </div>
        )}

        {/* 공문 본문 (인쇄용) */}
        <div id="print-area" className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div style={{fontFamily:'Nanum Myeongjo, serif', padding:'48px 56px', color:'#111'}}>
            <h1 style={{textAlign:'center', fontSize:'22pt', fontWeight:800, marginBottom:'32px', letterSpacing:'2px'}}>
              {doc.orgName}
            </h1>
            <div style={{marginBottom:'6px', display:'flex', gap:'12px', fontSize:'11pt'}}>
              <span style={{fontWeight:700, minWidth:'48px'}}>수신</span>
              <span>{doc.recipient}</span>
            </div>
            {doc.via && (
              <div style={{marginBottom:'6px', display:'flex', gap:'12px', fontSize:'11pt'}}>
                <span style={{fontWeight:700, minWidth:'48px'}}>(경유)</span>
                <span>{doc.via}</span>
              </div>
            )}
            <div style={{marginBottom:'6px', display:'flex', gap:'12px', fontSize:'11pt'}}>
              <span style={{fontWeight:700, minWidth:'48px'}}>제목</span>
              <span style={{fontWeight:700, fontSize:'12pt'}}>{doc.title}</span>
            </div>
            <div style={{height:'1px', background:'#ccc', margin:'16px 0'}}/>
            <div style={{fontSize:'11pt', lineHeight:'1.9', margin:'20px 0'}}
              dangerouslySetInnerHTML={{__html: doc.body}}
            />
            {doc.attachments?.filter(a => a.url).length > 0 && (
              <div style={{marginTop:'12px', padding:'12px', background:'#f8f9fa', borderRadius:'8px'}}>
                <p style={{fontSize:'10pt', fontWeight:700, marginBottom:'8px'}}>📎 첨부파일</p>
                {doc.attachments.filter(a => a.url).map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                    style={{display:'flex', alignItems:'center', gap:'8px', padding:'4px 0', fontSize:'10pt', color:'#1a56db', textDecoration:'none'}}>
                    📄 {a.name}
                    {a.size && <span style={{fontSize:'9pt', color:'#888'}}>({(a.size/1024).toFixed(0)}KB)</span>}
                  </a>
                ))}
              </div>
            )}
            {doc.attachments?.length > 0 && (
              <div style={{marginTop:'16px', fontSize:'10.5pt'}}>
                <span style={{fontWeight:700}}>붙임&nbsp;&nbsp;</span>
                {doc.attachments.map((a,i) => (
                  <span key={i}>{i > 0 ? <>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</> : ''}{i+1}. {a.name}{i < doc.attachments.length-1 ? '\n' : '. 끝'}</span>
                ))}
              </div>
            )}
            {doc.sealOrgName && (
              <div style={{textAlign:'center', margin:'36px 0 24px', position:'relative'}}>
                <span style={{fontSize:'16pt', fontWeight:700, letterSpacing:'1px', position:'relative', display:'inline-block'}}>
                  {doc.sealOrgName}
                  {doc.sealUrl ? (
                    <img src={doc.sealUrl} alt="직인"
                      style={{position:'absolute', top:'-20px', right:'-36px', width:'72px', height:'72px', opacity:0.85}}/>
                  ) : (
                    <span style={{
                      position:'absolute', top:'-20px', right:'-36px',
                      width:'68px', height:'68px', borderRadius:'4px',
                      border:'3px solid rgba(180,0,0,0.6)',
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                      color:'rgba(180,0,0,0.6)', fontSize:'9pt', fontWeight:700,
                      background:'rgba(255,255,255,0.1)',
                    }}>직인</span>
                  )}
                </span>
              </div>
            )}
            {/* 결재선 */}
            <div style={{borderTop:'1.5px solid #555', paddingTop:'8px', marginTop:'8px', display:'flex', gap:'0'}}>
              {allApprovers.map((a, i) => (
                <div key={i} style={{
                  flex:1, padding:'4px 8px',
                  borderRight: i < allApprovers.length-1 ? '0.5px solid #bbb' : 'none',
                }}>
                  <div style={{fontSize:'8.5pt', fontWeight:700, color:'#333', marginBottom:'2px'}}>{a.role}</div>
                  <div style={{fontSize:'10pt', fontWeight:700, marginBottom:'2px', position:'relative'}}>
                    {a.name}
                    {a.sealUrl && (a.status==='approved'||a.status==='submitted') && (
                      <img src={a.sealUrl} alt="직인"
                        style={{position:'absolute', top:'-8px', right:'-8px', width:'32px', height:'32px', opacity:0.85, objectFit:'contain'}}/>
                    )}
                  </div>
                  <div style={{fontSize:'7.5pt', color:'#666', lineHeight:'1.4'}}>
                    {a.actedAt ? formatDt(a.actedAt) + (a.status==='submitted'?'상신':a.status==='approved'?'결재':a.status==='rejected'?'반려':'') : '대기'}
                  </div>
                  {a.status === 'rejected' && a.comment && (
                    <div style={{fontSize:'7pt', color:'#c00', marginTop:'2px'}}>사유: {a.comment}</div>
                  )}
                </div>
              ))}
            </div>
            {/* 시행 정보 */}
            <div style={{borderTop:'1.5px solid #333', borderBottom:'1.5px solid #333', padding:'5px 0', marginTop:'12px', fontSize:'8.5pt'}}>
              <div style={{display:'flex', gap:'8px', padding:'2px 0'}}>
                <span><b>시행</b> {doc.docNo} ({doc.createdAt ? new Date((doc.createdAt as {toDate?:()=>Date}).toDate?.()??doc.createdAt as Date).toLocaleDateString('ko-KR') : ''})</span>
                <span style={{marginLeft:'auto'}}><b>접수</b></span>
              </div>
              <div style={{height:'0.5px', background:'#ddd', margin:'3px 0'}}/>
              <div style={{display:'flex', gap:'8px', padding:'2px 0', flexWrap:'wrap'}}>
                {doc.zipCode && <span>우{doc.zipCode}</span>}
                {doc.address && <span>주소 {doc.address}</span>}
                {doc.homepage && <span style={{marginLeft:'auto'}}>홈페이지 {doc.homepage}</span>}
              </div>
              <div style={{display:'flex', gap:'8px', padding:'2px 0', flexWrap:'wrap'}}>
                {doc.phone    && <span>전화 {doc.phone}</span>}
                {doc.fax      && <span>전송 {doc.fax}</span>}
                {doc.email    && <span>전자우편 {doc.email}</span>}
                <span style={{marginLeft:'auto', color:'#c00', fontWeight:700}}>{doc.isPublic}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 결재 처리 */}
        {isMyTurn && (
          <div className="bg-white border border-primary-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">결재 처리</h3>
            <textarea value={comment} onChange={e=>setComment(e.target.value)}
              placeholder="결재 의견 입력 (반려 시 필수)"
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
            <div className="flex gap-2">
              <button onClick={handleReject} disabled={acting}
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 disabled:opacity-50">
                <XCircle size={16}/> 반려
              </button>
              <button onClick={handleApprove} disabled={acting}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                <CheckCircle2 size={16}/> 결재
              </button>
            </div>
          </div>
        )}

        {/* 임시저장 문서 재작성 + 삭제 */}
        {isAuthor && doc.status === 'draft' && (
          <div className="space-y-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-amber-600 text-sm">임시저장된 문서입니다</span>
              <button
                onClick={() => router.push(`/approval/new?copyFrom=${id}`)}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors">
                이어 작성 및 상신
              </button>
            </div>
            <button onClick={async () => {
              if (!confirm('삭제하시겠습니까?')) return
              const { deleteApprovalDoc } = await import('@/lib/db')
              await deleteApprovalDoc(id)
              router.push('/approval')
            }}
              className="w-full flex items-center justify-center gap-2 py-3 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50">
              <Trash2 size={15}/> 문서 삭제
            </button>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap');
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </AppShell>
  )
}
