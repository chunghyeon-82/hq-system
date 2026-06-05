'use client'
import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import {
  listenUsers, listenApprovalTemplates, listenApprovalDocs,
  createApprovalDoc, saveApprovalTemplate, listenOfficialSeals,
  listenApprovalLines, listenRecipientContacts, getFooterInfo
} from '@/lib/db'
import type { AppUser, ApprovalDoc, ApprovalTemplate, Approver, OfficialSeal, ApprovalLine, RecipientContact } from '@/types'
import { Plus, Trash2, X, ChevronRight, Save, FileText, Eye, EyeOff, Users } from 'lucide-react'
import DocEditor from '@/components/DocEditor'
import { uploadAttachment, compressImage } from '@/lib/supabase-storage'
import clsx from 'clsx'

const ROLE_LABEL: Record<string,string> = {
  ADMIN:'관리자', HQ_CHIEF:'본부장', HQ_MEMBER:'본부팀원', BIZ_REP:'사업장담당자', ETC:'기타'
}
const PUBLIC_OPTIONS = ['공개','대외비','부분공개(1)','부분공개(2)','부분공개(3)','부분공개(4)','부분공개(5)','부분공개(6)','부분공개(7)']
const DEFAULT_TEMPLATES = [
  { id:'t1', name:'일반 기안문',  body:'1. \n\n2. ' },
  { id:'t2', name:'지출결의서',   body:'1. 지출 목적:\n\n2. 지출 내역:\n   - 금액: \n   - 지급방법: \n\n3. 지출 효과: ' },
  { id:'t3', name:'사업보고서',   body:'1. 사업 개요:\n\n2. 추진 경과:\n\n3. 향후 계획:\n\n4. 기타 사항: ' },
  { id:'t4', name:'구매품의서',   body:'1. 구매 품목:\n\n2. 규격 및 수량:\n\n3. 구매 이유:\n\n4. 예산 금액: ' },
  { id:'t5', name:'출장신청서',   body:'1. 출장 목적:\n\n2. 출장 기간:\n\n3. 출장지:\n\n4. 소요 예산: ' },
]

type Step = 'line' | 'write'

function ApprovalNewPageInner() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const copyFromId = searchParams.get('copyFrom')

  const [step, setStep] = useState<Step>('line')
  const [allUsers,  setAllUsers]  = useState<AppUser[]>([])
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([])
  const [allDocs,   setAllDocs]   = useState<ApprovalDoc[]>([])
  const [seals,     setSeals]     = useState<OfficialSeal[]>([])
  const [approvalLines,     setApprovalLines]     = useState<ApprovalLine[]>([])
  const [recipientContacts, setRecipientContacts] = useState<RecipientContact[]>([])
  const [showTplPicker, setShowTplPicker] = useState(false)
  const [showSaveTpl,   setShowSaveTpl]   = useState(false)
  const [showRecipientPicker, setShowRecipientPicker] = useState(false)
  // PC: true=좌우분할, false=작성만 / 모바일: 'write'|'preview' 탭
  const [showPreview,   setShowPreview]   = useState(true)
  const [mobileTab,     setMobileTab]     = useState<'write'|'preview'>('write')
  const [tplName,       setTplName]       = useState('')

  const [midApprovers,  setMidApprovers]  = useState<{uid:string;name:string;role:string}[]>([])
  const [finalApprover, setFinalApprover] = useState<{uid:string;name:string;role:string}|null>(null)
  const [viewers,       setViewers]       = useState<{uid:string;name:string;role:string}[]>([])

  const [orgName,     setOrgName]     = useState('')
  const [sealOrgName, setSealOrgName] = useState('')
  const [selectedSeal,setSelectedSeal]= useState<OfficialSeal|null>(null)
  const [recipient,   setRecipient]   = useState('')
  const [via,         setVia]         = useState('')
  const [docNo,       setDocNo]       = useState('')
  const [title,       setTitle]       = useState('')
  const [body,        setBody]        = useState('')
  const [attachNames, setAttachNames] = useState<string[]>([])
  const [address,     setAddress]     = useState('')
  const [zipCode,     setZipCode]     = useState('')
  const [phone,       setPhone]       = useState('')
  const [fax,         setFax]         = useState('')
  const [docEmail,    setDocEmail]    = useState('')
  const [homepage,    setHomepage]    = useState('')
  const [isPublic,    setIsPublic]    = useState('공개')
  const [saving,      setSaving]      = useState(false)

  const isHQ = user && ['ADMIN','HQ_CHIEF','HQ_MEMBER'].includes(user.role)

  useEffect(() => {
    if (loading) return
    if (!user || !isHQ) { router.replace('/dashboard'); return }
    const u1 = listenUsers(setAllUsers)
    const u2 = listenApprovalTemplates(user.uid, setTemplates)
    const u3 = listenOfficialSeals(setSeals)
    const u4 = listenApprovalDocs(user.uid, setAllDocs)
    const u5 = listenApprovalLines(user.uid, setApprovalLines)
    const u6 = listenRecipientContacts(user.uid, setRecipientContacts)
    getFooterInfo(user.uid).then(fi => {
      if (!fi) return
      if (fi.orgName)     setOrgName(fi.orgName)
      if (fi.sealOrgName) setSealOrgName(fi.sealOrgName)
      if (fi.zipCode)     setZipCode(fi.zipCode)
      if (fi.address)     setAddress(fi.address)
      if (fi.phone)       setPhone(fi.phone)
      if (fi.fax)         setFax(fi.fax)
      if (fi.email)       setDocEmail(fi.email)
      if (fi.homepage)    setHomepage(fi.homepage)
    })
    return () => { u1(); u2(); u3(); u4(); u5(); u6() }
  }, [user, loading, isHQ, router])

  useEffect(() => {
    if (!copyFromId || !allDocs.length) return
    const src = allDocs.find(d => d.id === copyFromId)
    if (!src) return
    setOrgName(src.orgName)
    setSealOrgName(src.sealOrgName)
    setRecipient(src.recipient)
    setVia(src.via ?? '')
    setTitle(src.title)
    setBody(src.body)
    setAttachNames(src.attachments?.map(a => a.name) ?? [])
    setAddress(src.address ?? '')
    setZipCode(src.zipCode ?? '')
    setPhone(src.phone ?? '')
    setFax(src.fax ?? '')
    setDocEmail(src.email ?? '')
    setHomepage(src.homepage ?? '')
    setIsPublic(src.isPublic ?? '공개')
  }, [copyFromId, allDocs])

  const hqUsers = allUsers.filter(u =>
    ['ADMIN','HQ_CHIEF','HQ_MEMBER'].includes(u.role) && u.uid !== user?.uid
  )

  const addMid = (u: AppUser) => {
    if (midApprovers.length >= 5 || midApprovers.some(a => a.uid === u.uid)) return
    setMidApprovers(p => [...p, { uid:u.uid, name:u.name, role:ROLE_LABEL[u.role]??u.role }])
  }
  const addViewer = (u: AppUser) => {
    if (viewers.some(v => v.uid === u.uid)) return
    setViewers(p => [...p, { uid:u.uid, name:u.name, role:ROLE_LABEL[u.role]??u.role }])
  }

  const applyTpl = (t: {body:string; orgName?:string; sealOrgName?:string; address?:string; zipCode?:string; phone?:string; fax?:string; email?:string; homepage?:string}) => {
    setBody(t.body)
    if (t.orgName)     setOrgName(t.orgName)
    if (t.sealOrgName) setSealOrgName(t.sealOrgName)
    if (t.address)     setAddress(t.address)
    if (t.zipCode)     setZipCode(t.zipCode)
    if (t.phone)       setPhone(t.phone)
    if (t.fax)         setFax(t.fax)
    if (t.email)       setDocEmail(t.email)
    if (t.homepage)    setHomepage(t.homepage)
    setShowTplPicker(false)
  }

  const attachRef   = useRef<HTMLInputElement>(null)
  const [attachFiles, setAttachFiles] = useState<{name:string; url:string; size:number; path:string}[]>([])
  const [uploading,   setUploading]   = useState(false)

  const handleSaveTpl = async () => {
    if (!user || !tplName.trim()) return
    await saveApprovalTemplate({ name:tplName.trim(), orgName, sealOrgName, body, address, zipCode, phone, fax, email:docEmail, homepage, ownerUid:user.uid })
    setTplName(''); setShowSaveTpl(false)
  }

  const handleAttachFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return
    const files = Array.from(e.target.files ?? []) as File[]
    if (attachFiles.length + files.length > 10) { alert('첨부파일은 최대 10개까지입니다'); return }
    setUploading(true)
    try {
      const newAttachments = await Promise.all(files.map(async (f: File) => {
        let uploadFile = f
        const isImage = f.type.startsWith('image/')
        if (isImage && f.size > 500 * 1024) {
          uploadFile = await compressImage(f)
        }
        const maxSize = 10 * 1024 * 1024
        if (uploadFile.size > maxSize) { alert(`${f.name} 파일이 너무 큽니다 (최대 10MB)`); return null }
        const { path, url, size } = await uploadAttachment(uploadFile, user.uid)
        return { name: f.name, url, size, path }
      }))
      const valid = newAttachments.filter((a): a is {name:string;url:string;size:number;path:string} => a !== null)
      setAttachFiles(prev => [...prev, ...valid])
    } catch(err) { console.error(err); alert('업로드 중 오류가 발생했습니다') }
    finally { setUploading(false); if (attachRef.current) attachRef.current.value = '' }
  }

  const handleSubmit = async (isDraft=false) => {
    if (!user) return
    if (!isDraft && !finalApprover) { alert('최종결재자를 선택해주세요'); return }
    if (!title.trim()) { alert('제목을 입력해주세요'); return }
    setSaving(true)
    try {
      const drafter: Approver = { uid:user.uid, name:user.name, role:'기안자', status:'submitted', actedAt:new Date().toISOString() }
      const approversList: Approver[] = midApprovers.map(a => ({ ...a, status:'waiting' as const }))
      const final: Approver = finalApprover
        ? { ...finalApprover, status:'waiting' }
        : { uid:user.uid, name:user.name, role:'최종결재', status:'waiting' }
      const viewerList: Approver[] = viewers.map(v => ({ ...v, status:'waiting' as const }))

      await createApprovalDoc({
        docNo, title, orgName,
        sealOrgName: sealOrgName || selectedSeal?.name || '',
        sealUrl: selectedSeal?.imageUrl ?? undefined,
        recipient, via, body,
        attachments: [
          ...attachNames.filter(Boolean).map(n => ({ name:n, url:'' })),
          ...attachFiles,
        ],
        drafter, approvers:approversList, finalApprover:final, viewers:viewerList,
        address, zipCode, phone, fax, email:docEmail, homepage,
        isPublic: isPublic as ApprovalDoc['isPublic'],
        status: isDraft ? 'draft' : 'pending',
        currentStep: isDraft ? 0 : 1,
        authorUid: user.uid,
        approvedAt: undefined, rejectedAt: undefined,
      })

      if (!isDraft) {
        const first = approversList[0] ?? final
        setTimeout(() => {
          fetch('/api/push', {
            method:'POST',
            headers:{'Content-Type':'application/json','Authorization':'Bearer hq-cleanup-2026'},
            body: JSON.stringify({ title:'새 결재 요청', body:`${user.name}이 "${title}" 결재를 요청했습니다`, url:'/approval', targetUids:[first.uid] }),
          }).catch(()=>{})
        }, 0)
      }
      router.push('/approval')
    } catch(e) {
      console.error(e); alert('오류가 발생했습니다')
    } finally { setSaving(false) }
  }

  const now = new Date()
  const todayStr = now.toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric' })
  const allApprovers = user ? [
    { uid:user.uid, name:user.name, role:'기안자', status:'submitted' as const },
    ...midApprovers.map(a => ({ ...a, status:'waiting' as const })),
    ...(finalApprover ? [{ ...finalApprover, status:'waiting' as const }] : []),
  ] : []

  const Preview = () => (
    <div style={{fontFamily:'Nanum Myeongjo, serif', padding:'32px 40px', color:'#111', fontSize:'10pt', lineHeight:'1.7', background:'white', border:'1px solid #ddd', borderRadius:'8px', minHeight:'600px'}}>
      <h1 style={{textAlign:'center', fontSize:'18pt', fontWeight:800, marginBottom:'24px', letterSpacing:'1px'}}>
        {orgName || '기관명'}
      </h1>
      <div style={{marginBottom:'4px', display:'flex', gap:'8px'}}>
        <span style={{fontWeight:700, minWidth:'40px'}}>수신</span>
        <span>{recipient || '수신처'}</span>
      </div>
      {via && (
        <div style={{marginBottom:'4px', display:'flex', gap:'8px'}}>
          <span style={{fontWeight:700, minWidth:'40px'}}>(경유)</span>
          <span>{via}</span>
        </div>
      )}
      <div style={{marginBottom:'4px', display:'flex', gap:'8px'}}>
        <span style={{fontWeight:700, minWidth:'40px'}}>제목</span>
        <span style={{fontWeight:700}}>{title || '제목'}</span>
      </div>
      <div style={{height:'1px', background:'#ccc', margin:'12px 0'}}/>
      <div style={{marginBottom:'16px', fontSize:'10pt'}}
        dangerouslySetInnerHTML={{__html: body || '<p style="color:#aaa">본문을 입력해주세요</p>'}}
      />
      {attachNames.filter(Boolean).length > 0 && (
        <div style={{marginBottom:'16px', fontSize:'9.5pt'}}>
          <span style={{fontWeight:700}}>붙임&nbsp;&nbsp;</span>
          {attachNames.filter(Boolean).map((n,i) => (
            <span key={i}>{i > 0 ? '         ' : ''}{i+1}. {n}{i === attachNames.filter(Boolean).length-1 ? '. 끝' : ''}</span>
          ))}
        </div>
      )}
      {sealOrgName && (
        <div style={{textAlign:'center', margin:'24px 0 16px', position:'relative'}}>
          <span style={{fontSize:'13pt', fontWeight:700, position:'relative', display:'inline-block'}}>
            {sealOrgName}
            {selectedSeal ? (
              <img src={selectedSeal.imageUrl} alt="직인" style={{position:'absolute', top:'-16px', right:'-28px', width:'56px', height:'56px', opacity:0.85}}/>
            ) : (
              <span style={{position:'absolute', top:'-14px', right:'-24px', width:'52px', height:'52px', borderRadius:'4px', border:'2px solid rgba(180,0,0,0.5)', display:'inline-flex', alignItems:'center', justifyContent:'center', color:'rgba(180,0,0,0.5)', fontSize:'7pt', fontWeight:700}}>직인</span>
            )}
          </span>
        </div>
      )}
      {allApprovers.length > 0 && (
        <div style={{borderTop:'1.5px solid #555', paddingTop:'6px', display:'flex'}}>
          {allApprovers.map((a,i) => (
            <div key={i} style={{flex:1, padding:'3px 6px', borderRight:i<allApprovers.length-1?'0.5px solid #bbb':'none'}}>
              <div style={{fontSize:'7.5pt', fontWeight:700, color:'#333'}}>{a.role}</div>
              <div style={{fontSize:'9pt', fontWeight:700}}>{a.name}</div>
              <div style={{fontSize:'6.5pt', color:'#888'}}>{todayStr.slice(5)}</div>
            </div>
          ))}
        </div>
      )}
      {(docNo || address || phone) && (
        <div style={{borderTop:'1.5px solid #333', borderBottom:'1.5px solid #333', padding:'4px 0', marginTop:'10px', fontSize:'7.5pt'}}>
          {docNo && <div><b>시행</b> {docNo} ({todayStr})&nbsp;&nbsp;&nbsp;<b>접수</b></div>}
          <div style={{height:'0.5px', background:'#ddd', margin:'2px 0'}}/>
          {(zipCode||address) && <div>{zipCode && `우${zipCode}`} {address && `주소 ${address}`}</div>}
          {(phone||fax||docEmail) && (
            <div style={{display:'flex', gap:'8px', justifyContent:'space-between'}}>
              {phone    && <span>전화 {phone}</span>}
              {fax      && <span>전송 {fax}</span>}
              {docEmail && <span>전자우편 {docEmail}</span>}
              <span style={{color:'#c00', fontWeight:700}}>{isPublic}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )

  // Step 1: 결재선 설정
  if (step === 'line') return (
    <AppShell title="기안 작성" back="/approval">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {copyFromId && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
            기존 문서를 복사해서 새 기안을 작성합니다
          </div>
        )}
        {approvalLines.filter(l => l.lineType === 'outgoing').length > 0 && (
          <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-primary-700 mb-2">저장된 결재선</p>
            <div className="flex flex-wrap gap-2">
              {approvalLines.filter(l => l.lineType === 'outgoing').map(line => (
                <button key={line.id}
                  onClick={() => { setMidApprovers(line.approvers); setFinalApprover(line.finalApprover) }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-primary-200 rounded-xl text-xs text-primary-700 hover:bg-primary-100 transition-colors">
                  {line.name}
                  <span className="text-primary-400">({line.approvers.length + 1}명)</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5">
          <h2 className="font-semibold text-gray-900">결재선 설정</h2>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">기안자</p>
            <div className="flex items-center gap-3 px-4 py-3 bg-primary-50 border border-primary-200 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-primary-200 flex items-center justify-center text-xs font-bold text-primary-800">{user?.name?.[0]}</div>
              <div><p className="text-sm font-medium text-primary-900">{user?.name}</p><p className="text-xs text-primary-500">기안자(본인)</p></div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">중간결재자 <span className="font-normal text-gray-300">({midApprovers.length}/5, 선택)</span></p>
            {midApprovers.map((a,i) => (
              <div key={a.uid} className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl mb-2">
                <span className="text-xs text-gray-400 w-4">{i+1}</span>
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">{a.name[0]}</div>
                <div className="flex-1"><p className="text-sm font-medium">{a.name}</p><p className="text-xs text-gray-400">{a.role}</p></div>
                <button onClick={() => setMidApprovers(p => p.filter((_,j)=>j!==i))}><X size={14} className="text-gray-300 hover:text-red-400"/></button>
              </div>
            ))}
            {midApprovers.length < 5 && (
              <div className="grid grid-cols-2 gap-2">
                {hqUsers.filter(u => !midApprovers.some(a=>a.uid===u.uid) && u.uid!==finalApprover?.uid).map(u => (
                  <button key={u.uid} onClick={() => addMid(u)}
                    className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-colors text-left">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">{u.name[0]}</div>
                    <div className="min-w-0"><p className="text-xs font-medium text-gray-700 truncate">{u.name}</p><p className="text-xs text-gray-400">{ROLE_LABEL[u.role]}</p></div>
                    <Plus size={12} className="text-gray-400 ml-auto shrink-0"/>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">최종결재자 <span className="text-red-400">*</span></p>
            {finalApprover ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center text-xs font-bold text-green-800">{finalApprover.name[0]}</div>
                <div className="flex-1"><p className="text-sm font-medium text-green-900">{finalApprover.name}</p><p className="text-xs text-green-600">{finalApprover.role}</p></div>
                <button onClick={() => setFinalApprover(null)}><X size={14} className="text-green-300 hover:text-red-400"/></button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {hqUsers.filter(u => !midApprovers.some(a=>a.uid===u.uid)).map(u => (
                  <button key={u.uid} onClick={() => setFinalApprover({uid:u.uid,name:u.name,role:ROLE_LABEL[u.role]??u.role})}
                    className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:bg-green-50 transition-colors text-left">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">{u.name[0]}</div>
                    <div className="min-w-0"><p className="text-xs font-medium text-gray-700 truncate">{u.name}</p><p className="text-xs text-gray-400">{ROLE_LABEL[u.role]}</p></div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">열람자 <span className="font-normal text-gray-300">(선택)</span></p>
            <div className="flex flex-wrap gap-2 mb-2">
              {viewers.map(v => (
                <div key={v.uid} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-full text-xs">
                  {v.name}<button onClick={() => setViewers(p=>p.filter(x=>x.uid!==v.uid))}><X size={10} className="text-gray-400 ml-0.5"/></button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {hqUsers.filter(u => !viewers.some(v=>v.uid===u.uid)).map(u => (
                <button key={u.uid} onClick={() => addViewer(u)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-gray-200 rounded-full text-xs text-gray-500 hover:border-gray-400 transition-colors">
                  <Plus size={10}/>{u.name}
                </button>
              ))}
              {recipientContacts.filter(c => !viewers.some(v => v.uid === c.id)).map(c => (
                <button key={c.id}
                  onClick={() => setViewers(p => [...p, { uid: c.id, name: c.name, role: c.org ?? '외부' }])}
                  className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-green-200 rounded-full text-xs text-green-600 hover:border-green-400 transition-colors">
                  <Plus size={10}/>{c.name} <span className="text-green-400">(외부)</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <button onClick={() => { if (!finalApprover) { alert('최종결재자를 선택해주세요'); return } setStep('write') }}
          className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-800 transition-colors flex items-center justify-center gap-2">
          다음 → 문서 작성 <ChevronRight size={18}/>
        </button>
      </div>
    </AppShell>
  )

  // Step 2: 문서 작성 + 미리보기
  // 작성 폼 공통 컴포넌트
  const WriteForm = () => (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setShowTplPicker(v=>!v)}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
          <FileText size={12}/> 템플릿
        </button>
        <button onClick={() => setShowSaveTpl(v=>!v)}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
          <Save size={12}/> 저장
        </button>
        {/* PC에서만 미리보기 토글 버튼 표시 */}
        <button onClick={() => setShowPreview(v=>!v)}
          className={clsx('hidden md:flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs transition-colors ml-auto',
            showPreview ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
          {showPreview ? <EyeOff size={12}/> : <Eye size={12}/>}
          {showPreview ? '미리보기 숨김' : '미리보기'}
        </button>
      </div>

      {showTplPicker && (
        <div className="bg-white border border-gray-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">기본 템플릿</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {DEFAULT_TEMPLATES.map(t => (
              <button key={t.id} onClick={() => applyTpl(t)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-left hover:bg-primary-50 hover:border-primary-300 transition-colors">
                {t.name}
              </button>
            ))}
          </div>
          {allDocs.filter(d => d.status === 'approved').length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-500 mb-2">결재완료 문서에서 불러오기</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {allDocs.filter(d => d.status === 'approved').slice(0, 5).map(d => (
                  <button key={d.id} onClick={() => applyTpl({
                    body:d.body, orgName:d.orgName, sealOrgName:d.sealOrgName,
                    address:d.address, zipCode:d.zipCode, phone:d.phone, fax:d.fax, email:d.email, homepage:d.homepage
                  })}
                    className="w-full text-left px-3 py-2 border border-green-100 bg-green-50 rounded-lg text-xs hover:bg-green-100 transition-colors truncate">
                    ↩ {d.title}
                  </button>
                ))}
              </div>
            </>
          )}
          {templates.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-500 mb-2 mt-3">저장된 템플릿</p>
              <div className="grid grid-cols-2 gap-2">
                {templates.map(t => (
                  <button key={t.id} onClick={() => applyTpl(t)}
                    className="px-3 py-2 border border-primary-200 bg-primary-50 rounded-lg text-xs text-left hover:bg-primary-100 transition-colors">
                    {t.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {showSaveTpl && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex gap-2">
          <input value={tplName} onChange={e=>setTplName(e.target.value)} placeholder="템플릿 이름"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"/>
          <button onClick={handleSaveTpl} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-xs">저장</button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        {[
          { label:'기관명 *', value:orgName, set:setOrgName, ph:'예: 충부사업기관' },
          { label:'(경유)',   value:via,     set:setVia,     ph:'경유처 (선택)' },
          { label:'문서번호', value:docNo,   set:setDocNo,   ph:'예: 충부사업기관2026-10' },
          { label:'제목 *',  value:title,   set:setTitle,   ph:'제목을 입력해주세요', bold:true },
        ].map(f => (
          <div key={f.label}>
            <label className="text-xs font-medium text-gray-500 block mb-1">{f.label}</label>
            <input value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
              className={clsx('w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400', f.bold && 'font-semibold')}/>
          </div>
        ))}
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">수신처 *</label>
          <div className="relative">
            <input value={recipient} onChange={e=>setRecipient(e.target.value)}
              placeholder="예: 직접입력"
              onFocus={() => setShowRecipientPicker(true)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
            {showRecipientPicker && allUsers.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                <div className="p-2 border-b border-gray-100">
                  <p className="text-xs text-gray-400">시스템 내 멤버 선택 또는 직접 입력</p>
                </div>
                {allUsers.map(u => (
                  <button key={u.uid}
                    onClick={() => { setRecipient(u.name); setShowRecipientPicker(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left">
                    <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 shrink-0">{u.name[0]}</div>
                    <div>
                      <p className="text-sm text-gray-800">{u.name}</p>
                      <p className="text-xs text-gray-400">{ROLE_LABEL[u.role] ?? u.role}</p>
                    </div>
                  </button>
                ))}
                <button onClick={() => setShowRecipientPicker(false)}
                  className="w-full py-2 text-xs text-gray-400 hover:bg-gray-50 border-t border-gray-100">닫기</button>
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">본문 *</label>
          <DocEditor value={body} onChange={setBody} placeholder="1. 본문 내용을 입력해주세요" minHeight={280}/>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-500">붙임 <span className="text-gray-300">({attachFiles.length + attachNames.filter(Boolean).length}/10)</span></label>
            <div className="flex gap-2">
              <button onClick={() => { if(attachFiles.length + attachNames.filter(Boolean).length >= 10){alert('최대 10개');return}; setAttachNames(p=>[...p,'']) }}
                className="text-xs text-gray-500 flex items-center gap-1 hover:text-gray-700"><Plus size={10}/> 이름 입력</button>
              <button onClick={() => attachRef.current?.click()} disabled={uploading || attachFiles.length + attachNames.filter(Boolean).length >= 10}
                className="text-xs text-primary-600 flex items-center gap-1 hover:text-primary-800 disabled:opacity-40"><Plus size={10}/> 파일 첨부</button>
            </div>
          </div>
          <input ref={attachRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.bmp,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={handleAttachFiles} className="hidden"/>
          {uploading && <p className="text-xs text-primary-500 mb-1">업로드 중...</p>}
          {attachNames.map((n,i) => (
            <div key={`n${i}`} className="flex gap-2 mb-1">
              <input value={n} onChange={e=>setAttachNames(p=>p.map((x,j)=>j===i?e.target.value:x))}
                placeholder={`${i+1}. 파일명`}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              <button onClick={() => setAttachNames(p=>p.filter((_,j)=>j!==i))}><Trash2 size={13} className="text-gray-300 hover:text-red-400"/></button>
            </div>
          ))}
          {attachFiles.map((f,i) => (
            <div key={`f${i}`} className="flex items-center gap-2 mb-1 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
              <span className="text-xs text-blue-700 flex-1 truncate">📎 {f.name}</span>
              <span className="text-xs text-gray-400">{(f.size/1024).toFixed(0)}KB</span>
              <button onClick={() => setAttachFiles(p=>p.filter((_,j)=>j!==i))}><Trash2 size={12} className="text-gray-300 hover:text-red-400"/></button>
            </div>
          ))}
          <p className="text-xs text-gray-400 mt-1">PDF, JPG, BMP, HWP, HWPX 등 · 최대 10개 · 이미지 자동 압축</p>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">직인 위 기관명</label>
          <input value={sealOrgName} onChange={e=>setSealOrgName(e.target.value)} placeholder="예: 충부사업기관장"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
        </div>
        {seals.length > 0 && (
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">등록된 직인</label>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSelectedSeal(null)}
                className={clsx('flex flex-col items-center gap-1 p-2 border rounded-xl text-xs transition-colors',
                  !selectedSeal ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-400')}>
                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-300">없</div>
                <span>없음</span>
              </button>
              {seals.map(s => (
                <button key={s.id} onClick={() => setSelectedSeal(s)}
                  className={clsx('flex flex-col items-center gap-1 p-2 border rounded-xl text-xs transition-colors',
                    selectedSeal?.id === s.id ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:bg-gray-50')}>
                  <div className="w-8 h-8 flex items-center justify-center">
                    <img src={s.imageUrl} alt={s.name} className="max-w-full max-h-full object-contain"/>
                  </div>
                  <span className="truncate max-w-[56px]">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <h3 className="text-xs font-semibold text-gray-600 mb-3">하단 발신 정보</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            {label:'우편번호', value:zipCode,  set:setZipCode,  ph:'54536'},
            {label:'주소',     value:address,  set:setAddress,  ph:'전북 익산시 ...'},
            {label:'전화',     value:phone,    set:setPhone,    ph:'063-842-3844'},
            {label:'전송',     value:fax,      set:setFax,      ph:'063-857-3844'},
            {label:'전자우편', value:docEmail, set:setDocEmail, ph:'example@won.or.kr'},
            {label:'홈페이지', value:homepage, set:setHomepage, ph:'www.example.or.kr'},
          ].map(f => (
            <div key={f.label}>
              <label className="text-xs text-gray-400 block mb-1">{f.label}</label>
              <input value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"/>
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-400 block mb-1">공개여부</label>
            <select value={isPublic} onChange={e=>setIsPublic(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
              {PUBLIC_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pb-4">
        <button onClick={() => handleSubmit(true)} disabled={saving}
          className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50">
          임시저장
        </button>
        <button onClick={() => handleSubmit(false)} disabled={saving || !title.trim()}
          className="flex-1 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
          {saving ? '처리 중..' : '결재 상신'}
        </button>
      </div>
    </div>
  )

  return (
    <AppShell title="기안 작성" back="/approval">
      {/* ── 모바일: 탭 전환 ── */}
      <div className="md:hidden flex flex-col h-full">
        {/* 탭 헤더 */}
        <div className="flex border-b border-gray-200 bg-white shrink-0">
          <button
            onClick={() => setMobileTab('write')}
            className={clsx('flex-1 py-3 text-sm font-medium transition-colors',
              mobileTab === 'write' ? 'text-primary-700 border-b-2 border-primary-600' : 'text-gray-500')}>
            작성
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            className={clsx('flex-1 py-3 text-sm font-medium transition-colors',
              mobileTab === 'preview' ? 'text-primary-700 border-b-2 border-primary-600' : 'text-gray-500')}>
            미리보기
          </button>
        </div>
        {/* 탭 내용 */}
        <div className="flex-1 overflow-y-auto">
          {mobileTab === 'write' ? (
            <WriteForm/>
          ) : (
            <div className="bg-gray-100 p-4 min-h-full">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 text-center">미리보기</p>
              <Preview/>
            </div>
          )}
        </div>
      </div>

      {/* ── PC: 좌우 분할 ── */}
      <div className="hidden md:flex h-full">
        <div className={clsx('overflow-y-auto', showPreview ? 'w-1/2 border-r border-gray-200' : 'w-full')}>
          <WriteForm/>
        </div>
        {showPreview && (
          <div className="w-1/2 overflow-y-auto bg-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 text-center">미리보기</p>
            <Preview/>
          </div>
        )}
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap');`}</style>
    </AppShell>
  )
}

export default function ApprovalNewPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"/>
      </div>
    }>
      <ApprovalNewPageInner/>
    </Suspense>
  )
}
