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
    return () => { u1(); u2(); u3() }  // dead code ?쒓굅
  }, [user, loading, router])

  const doc = docs.find(d => d.id === id)

  if (loading || !doc) return (
    <AppShell title="諛쒖떊怨듬Ц ?곸꽭" back="/approval">
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">遺덈윭?ㅻ뒗 以?.</div>
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
        body: JSON.stringify({ title:'??寃곗옱 ?꾨즺', body:`"${doc.title}" 理쒖쥌 寃곗옱媛 ?꾨즺?먯뒿?덈떎`, url:'/approval', targetUids:[doc.authorUid] }),
      }).catch(()=>{})
    } else if (allDone) {
      fetch('/api/push', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer hq-cleanup-2026'},
        body: JSON.stringify({ title:'??寃곗옱 ?붿껌', body:`"${doc.title}" 寃곗옱瑜??붿껌?⑸땲??, url:'/approval', targetUids:[doc.finalApprover.uid] }),
      }).catch(()=>{})
    }
    setComment(''); setActing(false)
  }

  const handleReject = async () => {
    if (!user || acting || !comment.trim()) { alert('諛섎젮 ?ъ쑀瑜??낅젰?댁＜?몄슂'); return }
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
    if (!emailTo.length) { alert('?섏떊?먮? ?좏깮?댁＜?몄슂'); return }
    setSending(true)
    try {
      const res = await fetch('/api/email', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer hq-cleanup-2026'},
        body: JSON.stringify({
          to: emailTo.map(e => e.email),
          subject: `[怨듬Ц] ${doc.title}`,
          html: `<p><b>${doc.orgName}</b></p><hr/><p><b>?섏떊:</b> ${doc.recipient}</p><p><b>?쒕ぉ:</b> ${doc.title}</p><br/><div>${doc.body.replace(/\n/g,'<br/>')}</div>`,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      await updateApprovalDoc(id, { isSent: true, sentAt: new Date().toISOString() })
      alert('?대찓?쇱씠 諛쒖넚?먯뒿?덈떎')
      setShowEmail(false)
    } catch(e: unknown) {
      const msg = e instanceof Error ? e.message : '?????녿뒗 ?ㅻ쪟'
      alert(`諛쒖넚 ?ㅽ뙣: ${msg}`)
    } finally { setSending(false) }
  }

  const addEmailTo = (name: string, email: string, save=false) => {
    if (emailTo.some(e => e.email === email)) return
    setEmailTo(p => [...p, {name, email}])
    if (save && user) saveEmailContact(user.uid, name, email)
    setNewEmail(''); setNewName('')
  }

  const getRoleLabel = (role: string) => {
    if (role === '기안자') return '기안'
    if (role === '본부장' || role === 'HQ_CHIEF') return '본부장'
    if (role === '본부멤버' || role === 'HQ_MEMBER') return '담당'
    if (role === '관리자' || role === 'ADMIN') return '관리자'
    if (role === '최종결재' || role === '최종결재자') return '본부장'
    return role
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
  const STATUS_LABEL: Record<string,string> = { draft:'?꾩떆???, pending:'寃곗옱以?, approved:'寃곗옱?꾨즺', rejected:'諛섎젮' }

  return (
    <AppShell title="諛쒖떊怨듬Ц" back="/approval">
      <div className="max-w-4xl mx-auto p-4 space-y-4">

        {/* ?곹깭 + ?≪뀡 踰꾪듉 */}
        <div className="flex items-center justify-between">
          <span className={clsx('text-sm font-medium px-3 py-1.5 rounded-full', STATUS_COLOR[doc.status])}>
            {STATUS_LABEL[doc.status]}
          </span>
          <div className="flex gap-2">
            {isApproved && isAuthor && (
              <button onClick={() => setShowEmail(v=>!v)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-800">
                <Mail size={15}/> ?대찓??諛쒖넚
              </button>
            )}
            {isHQ && (
              <button onClick={() => router.push(`/approval/new?copyFrom=${id}`)}
                className="flex items-center gap-2 px-4 py-2 border border-primary-200 text-primary-700 rounded-xl text-sm font-medium hover:bg-primary-50 transition-colors">
                ??臾몄꽌濡???湲곗븞
              </button>
            )}
            <button onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50">
              <Printer size={15}/> ?몄뇙
            </button>
          </div>
        </div>

        {/* ?대찓??諛쒖넚 ?⑤꼸 */}
        {showEmail && (
          <div className="bg-white border border-primary-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm">?대찓??諛쒖넚</h3>
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
                <p className="text-xs text-gray-500 mb-2">?섏떊??紐⑸줉</p>
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
                <p className="text-xs text-gray-500 mb-2">?댁쟾 諛쒖넚 ?곕씫泥?/p>
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
              <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="?대쫫"
                className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="?대찓??二쇱냼"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              <button onClick={() => addEmailTo(newName||newEmail, newEmail, true)}
                disabled={!newEmail.includes('@')}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 disabled:opacity-40">
                異붽?+???              </button>
            </div>
            <button onClick={handleSendEmail} disabled={sending || !emailTo.length}
              className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
              {sending ? '諛쒖넚 以?.' : `${emailTo.length}紐낆뿉寃??대찓??諛쒖넚`}
            </button>
          </div>
        )}

                {/* 怨듬Ц 蹂몃Ц (A4 ?섏씠吏 ?뺥깭) */}
        <div id="print-area" className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div style={{fontFamily:'Nanum Myeongjo, serif', color:'#111', width:'100%', boxSizing:'border-box', display:'flex', flexDirection:'column', minHeight:'1100px'}}>

            {/* ?곷떒 蹂몃Ц ?곸뿭 */}
            <div style={{padding:'40px 56px 24px 56px', flex:1}}>
              {/* 湲곌?紐?*/}
              <h1 style={{textAlign:'center', fontSize:'20pt', fontWeight:800, marginBottom:'28px', letterSpacing:'3px'}}>
                {doc.orgName}
              </h1>
              {/* ?섏떊/寃쎌쑀/?쒕ぉ */}
              <div style={{marginBottom:'4px', display:'flex', fontSize:'10.5pt'}}>
                <span style={{fontWeight:700, minWidth:'52px'}}>?섏떊??/span>
                <span>{doc.recipient}</span>
              </div>
              {doc.via && (
                <div style={{marginBottom:'4px', display:'flex', fontSize:'10.5pt'}}>
                  <span style={{fontWeight:700, minWidth:'52px'}}>(寃쎌쑀)</span>
                  <span>{doc.via}</span>
                </div>
              )}
              {/* ?섏떊???꾨옒 ??*/}
              <div style={{height:'2px', background:'#333', margin:'8px 0'}}/>
              <div style={{marginBottom:'4px', display:'flex', fontSize:'10.5pt'}}>
                <span style={{fontWeight:700, minWidth:'52px'}}>?쒕ぉ</span>
                <span style={{fontWeight:700}}>{doc.title}</span>
              </div>
              {/* ?쒕ぉ ?꾨옒 ??*/}
              <div style={{height:'1px', background:'#999', margin:'8px 0 20px 0'}}/>
              {/* 蹂몃Ц */}
              <div
                style={{fontSize:'10.5pt', lineHeight:'2.0'}}
                dangerouslySetInnerHTML={{__html: doc.body}}
              />
              {/* 遺숈엫 */}
              {doc.attachments?.length > 0 && (
                <div style={{marginTop:'24px', fontSize:'10.5pt'}}>
                  {doc.attachments.length === 1 ? (
                    <div style={{display:'flex'}}>
                      <span style={{fontWeight:700, minWidth:'52px'}}>遺숈엫</span>
                      <span>{doc.attachments[0].name} 1遺.&nbsp;&nbsp;??</span>
                    </div>
                  ) : (
                    <div style={{display:'flex'}}>
                      <span style={{fontWeight:700, minWidth:'52px'}}>遺숈엫</span>
                      <div>
                        {doc.attachments.map((a, i) => (
                          <div key={i}>
                            {i+1}. {a.name} 1遺.{i === doc.attachments.length-1 ? '혻혻??' : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* 泥⑤??뚯씪 ?ㅼ슫濡쒕뱶 */}
              {doc.attachments?.filter(a => a.url).length > 0 && (
                <div style={{marginTop:'12px', padding:'10px 14px', background:'#f8f9fa', borderRadius:'6px', fontSize:'9.5pt'}}>
                  <p style={{fontWeight:700, marginBottom:'6px', color:'#555'}}>?뱨 泥⑤??뚯씪 ?ㅼ슫濡쒕뱶</p>
                  {doc.attachments.filter(a => a.url).map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                      style={{display:'flex', alignItems:'center', gap:'8px', padding:'3px 0', color:'#1a56db', textDecoration:'none'}}>
                      ?뱞 {a.name}
                      {a.size && <span style={{fontSize:'8.5pt', color:'#888'}}>({(a.size/1024).toFixed(0)}KB)</span>}
                    </a>
                  ))}
                </div>
              )}
              {/* 諛쒖떊 湲곌?紐?+ 吏곸씤 */}
              {doc.sealOrgName && (
                <div style={{textAlign:'center', margin:'48px 0 24px', position:'relative'}}>
                  <span style={{fontSize:'14pt', fontWeight:700, letterSpacing:'1px', position:'relative', display:'inline-block'}}>
                    {doc.sealOrgName}
                    {doc.sealUrl ? (
                      <img src={doc.sealUrl} alt="吏곸씤"
                        style={{position:'absolute', top:'-18px', right:'-36px', width:'68px', height:'68px', opacity:0.85}}/>
                    ) : (
                      <span style={{
                        position:'absolute', top:'-18px', right:'-36px',
                        width:'64px', height:'64px', borderRadius:'4px',
                        border:'2.5px solid rgba(180,0,0,0.6)',
                        display:'inline-flex', alignItems:'center', justifyContent:'center',
                        color:'rgba(180,0,0,0.6)', fontSize:'8pt', fontWeight:700,
                      }}>吏곸씤</span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* 寃곗옱??+ ?쒗뻾 ?뺣낫 ???섎떒 */}
            <div style={{padding:'0 56px 40px 56px'}}>
              {/* 寃곗옱????移??놁씠 吏곸콉 ?대쫫 ?섏뿴 */}
              <div style={{fontSize:'10pt', marginBottom:'6px', display:'flex', flexWrap:'wrap', gap:'0 32px', lineHeight:'1.8'}}>
                {allApprovers.map((a, i) => (
                  <span key={i} style={{display:'inline-flex', gap:'8px', alignItems:'baseline'}}>
                    <span style={{fontSize:'9pt', color:'#555'}}>{getRoleLabel(a.role)}</span>
                    <span style={{fontWeight:700, position:'relative', display:'inline-block'}}>
                      {a.name}
                      {a.sealUrl && (a.status==='approved'||a.status==='submitted') && (
                        <img src={a.sealUrl} alt="吏곸씤"
                          style={{position:'absolute', top:'-10px', left:'50%', transform:'translateX(-50%)', width:'32px', height:'32px', opacity:0.85, objectFit:'contain'}}/>
                      )}
                    </span>
                  </span>
                ))}
              </div>

              {/* ?쒗뻾/?묒닔 */}
              <div style={{borderTop:'1px solid #555', padding:'4px 0', marginTop:'4px', fontSize:'9pt'}}>
                <div style={{display:'flex', gap:'24px', padding:'2px 0'}}>
                  <span>
                    <b>?쒗뻾</b>&nbsp;{doc.docNo}&nbsp;
                    ({doc.createdAt ? new Date((doc.createdAt as {toDate?:()=>Date}).toDate?.()??doc.createdAt as Date).toLocaleDateString('ko-KR') : ''})
                  </span>
                  <span><b>?묒닔</b></span>
                </div>
                <div style={{height:'0.5px', background:'#ccc', margin:'3px 0'}}/>
                <div style={{display:'flex', gap:'6px', padding:'2px 0', flexWrap:'wrap'}}>
                  {doc.zipCode && <span>??doc.zipCode}</span>}
                  {doc.address && <span>&nbsp;{doc.address}</span>}
                  {doc.homepage && <span>&nbsp;/{doc.homepage}</span>}
                </div>
                <div style={{display:'flex', justifyContent:'space-between', padding:'2px 0', flexWrap:'wrap'}}>
                  <div style={{display:'flex', gap:'4px'}}>
                    {doc.phone && <span>?꾪솕 {doc.phone}</span>}
                    {doc.fax   && <span>&nbsp;?꾩넚 {doc.fax}</span>}
                    {doc.email && <span>&nbsp;{doc.email}</span>}
                  </div>
                  <span style={{color:'#c00', fontWeight:700}}>/{doc.isPublic}</span>
                </div>
              </div>
              {/* ?섎떒 湲곌?紐?*/}
              <div style={{textAlign:'center', fontSize:'9pt', marginTop:'4px', color:'#444'}}>
                {doc.orgName}
              </div>
            </div>
          </div>
        </div>

        {/* 寃곗옱 泥섎━ */}
        {isMyTurn && (
          <div className="bg-white border border-primary-200 rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">寃곗옱 泥섎━</h3>
            <textarea value={comment} onChange={e=>setComment(e.target.value)}
              placeholder="寃곗옱 ?섍껄 ?낅젰 (諛섎젮 ???꾩닔)"
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
            <div className="flex gap-2">
              <button onClick={handleReject} disabled={acting}
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 disabled:opacity-50">
                <XCircle size={16}/> 諛섎젮
              </button>
              <button onClick={handleApprove} disabled={acting}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                <CheckCircle2 size={16}/> 寃곗옱
              </button>
            </div>
          </div>
        )}

        {/* ?꾩떆???臾몄꽌 ?ъ옉??+ ??젣 */}
        {isAuthor && doc.status === 'draft' && (
          <div className="space-y-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-amber-600 text-sm">?꾩떆??λ맂 臾몄꽌?낅땲??/span>
              <button
                onClick={() => router.push(`/approval/new?copyFrom=${id}`)}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors">
                ?댁뼱 ?묒꽦 諛??곸떊
              </button>
            </div>
            <button onClick={async () => {
              if (!confirm('??젣?섏떆寃좎뒿?덇퉴?')) return
              const { deleteApprovalDoc } = await import('@/lib/db')
              await deleteApprovalDoc(id)
              router.push('/approval')
            }}
              className="w-full flex items-center justify-center gap-2 py-3 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50">
              <Trash2 size={15}/> 臾몄꽌 ??젣
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

