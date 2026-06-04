'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import {
  listenUsers, listenApprovalTemplates,
  createApprovalDoc, saveApprovalTemplate
} from '@/lib/db'
import type { AppUser, ApprovalDoc, ApprovalTemplate, Approver } from '@/types'
import { Plus, Trash2, X, ChevronRight, Save, FileText } from 'lucide-react'
import clsx from 'clsx'

const ROLE_LABEL: Record<string,string> = {
  ADMIN:'관리자', HQ_CHIEF:'본부장', HQ_MEMBER:'본부멤버', BIZ_REP:'사업장대표', ETC:'기타'
}
const PUBLIC_OPTIONS = ['공개','부분공개','비공개(1)','비공개(2)','비공개(3)','비공개(4)','비공개(5)','비공개(6)','비공개(7)']
const DEFAULT_TEMPLATES = [
  { id:'t1', name:'일반 기안서',  body:'1. \n\n2. ' },
  { id:'t2', name:'지출결의서',   body:'1. 지출 목적:\n\n2. 지출 내역:\n   - 금액: \n   - 산출근거: \n\n3. 지출 방법: ' },
  { id:'t3', name:'업무보고서',   body:'1. 업무 개요:\n\n2. 추진 현황:\n\n3. 향후 계획:\n\n4. 기타 사항: ' },
  { id:'t4', name:'구매요청서',   body:'1. 구매 품목:\n\n2. 수량 및 규격:\n\n3. 구매 사유:\n\n4. 예상 금액: ' },
  { id:'t5', name:'출장신청서',   body:'1. 출장 목적:\n\n2. 출장 기간:\n\n3. 출장지:\n\n4. 소요 예산: ' },
]
type Step = 'line' | 'write'

export default function ApprovalNewPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>('line')
  const [allUsers,  setAllUsers]  = useState<AppUser[]>([])
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([])
  const [showTplPicker, setShowTplPicker] = useState(false)
  const [showSaveTpl,   setShowSaveTpl]   = useState(false)
  const [tplName,       setTplName]       = useState('')

  // 결재선
  const [midApprovers,  setMidApprovers]  = useState<{uid:string;name:string;role:string}[]>([])
  const [finalApprover, setFinalApprover] = useState<{uid:string;name:string;role:string}|null>(null)
  const [viewers,       setViewers]       = useState<{uid:string;name:string;role:string}[]>([])

  // 문서
  const [orgName,    setOrgName]    = useState('')
  const [sealOrgName,setSealOrgName]= useState('')
  const [recipient,  setRecipient]  = useState('')
  const [via,        setVia]        = useState('')
  const [docNo,      setDocNo]      = useState('')
  const [title,      setTitle]      = useState('')
  const [body,       setBody]       = useState('')
  const [attachNames,setAttachNames]= useState<string[]>([])
  const [address,    setAddress]    = useState('')
  const [zipCode,    setZipCode]    = useState('')
  const [phone,      setPhone]      = useState('')
  const [fax,        setFax]        = useState('')
  const [docEmail,   setDocEmail]   = useState('')
  const [homepage,   setHomepage]   = useState('')
  const [isPublic,   setIsPublic]   = useState('공개')
  const [saving,     setSaving]     = useState(false)

  const isHQ = user && ['ADMIN','HQ_CHIEF','HQ_MEMBER'].includes(user.role)

  useEffect(() => {
    if (loading) return
    if (!user || !isHQ) { router.replace('/dashboard'); return }
    const u1 = listenUsers(setAllUsers)
    const u2 = listenApprovalTemplates(user.uid, setTemplates)
    return () => { u1(); u2() }
  }, [user, loading, isHQ, router])

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
    if (t.orgName)    setOrgName(t.orgName)
    if (t.sealOrgName) setSealOrgName(t.sealOrgName)
    if (t.address)    setAddress(t.address)
    if (t.zipCode)    setZipCode(t.zipCode)
    if (t.phone)      setPhone(t.phone)
    if (t.fax)        setFax(t.fax)
    if (t.email)      setDocEmail(t.email)
    if (t.homepage)   setHomepage(t.homepage)
    setShowTplPicker(false)
  }

  const handleSaveTpl = async () => {
    if (!user || !tplName.trim()) return
    await saveApprovalTemplate({ name:tplName.trim(), orgName, sealOrgName, body, address, zipCode, phone, fax, email:docEmail, homepage, ownerUid:user.uid })
    setTplName(''); setShowSaveTpl(false)
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
        docNo, title, orgName, sealOrgName, recipient, via, body,
        attachments: attachNames.filter(Boolean).map(n => ({ name:n, url:'' })),
        sealUrl: undefined,
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
            headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer hq-cleanup-2026' },
            body: JSON.stringify({ title:'📋 결재 요청', body:`${user.name}님이 "${title}" 결재를 요청했습니다`, url:'/approval', targetUids:[first.uid] }),
          }).catch(()=>{})
        }, 0)
      }
      router.push('/approval')
    } catch(e) {
      console.error(e); alert('저장 중 오류가 발생했습니다')
    } finally { setSaving(false) }
  }

  // ── Step 1: 결재선 ─────────────────────────
  if (step === 'line') return (
    <AppShell title="기안 작성" back="/approval">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5">
          <h2 className="font-semibold text-gray-900">결재선 설정</h2>

          {/* 기안자 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">기안자</p>
            <div className="flex items-center gap-3 px-4 py-3 bg-primary-50 border border-primary-200 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-primary-200 flex items-center justify-center text-xs font-bold text-primary-800">{user?.name?.[0]}</div>
              <div><p className="text-sm font-medium text-primary-900">{user?.name}</p><p className="text-xs text-primary-500">기안자 (본인)</p></div>
            </div>
          </div>

          {/* 중간결재자 */}
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

          {/* 최종결재자 */}
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

          {/* 공람자 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">공람자 <span className="font-normal text-gray-300">(선택)</span></p>
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
            </div>
          </div>
        </div>

        <button onClick={() => { if (!finalApprover) { alert('최종결재자를 선택해주세요'); return } setStep('write') }}
          className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-800 transition-colors flex items-center justify-center gap-2">
          다음 — 문서 작성 <ChevronRight size={18}/>
        </button>
      </div>
    </AppShell>
  )

  // ── Step 2: 문서 작성 ───────────────────────
  return (
    <AppShell title="기안 작성" back="/approval">
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex gap-2">
          <button onClick={() => setShowTplPicker(v=>!v)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <FileText size={14}/> 템플릿 불러오기
          </button>
          <button onClick={() => setShowSaveTpl(v=>!v)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            <Save size={14}/> 템플릿 저장
          </button>
        </div>

        {showTplPicker && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-500 mb-3">기본 템플릿</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {DEFAULT_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => applyTpl(t)}
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-left hover:bg-primary-50 hover:border-primary-300 transition-colors">
                  {t.name}
                </button>
              ))}
            </div>
            {templates.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-500 mb-2">저장된 템플릿</p>
                <div className="grid grid-cols-3 gap-2">
                  {templates.map(t => (
                    <button key={t.id} onClick={() => applyTpl(t)}
                      className="px-3 py-2.5 border border-primary-200 bg-primary-50 rounded-lg text-sm text-left hover:bg-primary-100 transition-colors">
                      {t.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {showSaveTpl && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-2">
            <input value={tplName} onChange={e=>setTplName(e.target.value)} placeholder="템플릿 이름 입력"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
            <button onClick={handleSaveTpl} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">저장</button>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          {[
            { label:'조직명 *',  value:orgName,    set:setOrgName,    ph:'예: 총부사업기관 원창' },
            { label:'수신자 *',  value:recipient,  set:setRecipient,  ph:'예: 재정부원장' },
            { label:'(경유)',    value:via,        set:setVia,        ph:'경유자 (선택)' },
            { label:'문서번호',  value:docNo,      set:setDocNo,      ph:'예: 총부사업기관원창2026-10' },
            { label:'제목 *',    value:title,      set:setTitle,      ph:'제목을 입력하세요', bold:true },
          ].map(f => (
            <div key={f.label}>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">{f.label}</label>
              <input value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
                className={clsx('w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400', f.bold && 'font-semibold')}/>
            </div>
          ))}

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">본문 *</label>
            <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="본문 내용을 입력하세요" rows={12}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-gray-500">붙임</label>
              <button onClick={() => setAttachNames(p=>[...p,''])} className="text-xs text-primary-600 flex items-center gap-1">
                <Plus size={11}/> 추가
              </button>
            </div>
            {attachNames.map((n,i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input value={n} onChange={e=>setAttachNames(p=>p.map((x,j)=>j===i?e.target.value:x))}
                  placeholder={`${i+1}. 파일명 입력`}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                <button onClick={() => setAttachNames(p=>p.filter((_,j)=>j!==i))}><Trash2 size={14} className="text-gray-300 hover:text-red-400"/></button>
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">직인 위 조직명</label>
            <input value={sealOrgName} onChange={e=>setSealOrgName(e.target.value)} placeholder="예: 기획운영본부장"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">하단 발신 정보</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              {label:'우편번호', value:zipCode,  set:setZipCode,  ph:'54536'},
              {label:'주소',     value:address,  set:setAddress,  ph:'전북 익산시 ...'},
              {label:'전화',     value:phone,    set:setPhone,    ph:'063-842-3844'},
              {label:'전송(팩스)',value:fax,     set:setFax,      ph:'063-857-3844'},
              {label:'전자우편', value:docEmail, set:setDocEmail, ph:'example@won.or.kr'},
              {label:'홈페이지', value:homepage, set:setHomepage, ph:'www.example.or.kr'},
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs text-gray-400 block mb-1">{f.label}</label>
                <input value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.ph}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-400 block mb-1">공개여부</label>
              <select value={isPublic} onChange={e=>setIsPublic(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none">
                {PUBLIC_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pb-4">
          <button onClick={() => handleSubmit(true)} disabled={saving}
            className="flex-1 py-3.5 border border-gray-300 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
            임시저장
          </button>
          <button onClick={() => handleSubmit(false)} disabled={saving || !title.trim()}
            className="flex-1 py-3.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
            {saving ? '제출 중...' : '결재 상신'}
          </button>
        </div>
      </div>
    </AppShell>
  )
}
