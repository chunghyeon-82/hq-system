'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import {
  listenUsers, listenApprovalLines,
  createInternalDoc, listenInternalDocs, listenOfficialSeals
} from '@/lib/db'
import { uploadAttachment } from '@/lib/supabase-storage'
import type { AppUser, ApprovalLine, Approver, InternalDoc, BudgetItem, OfficialSeal } from '@/types'
import { Plus, X, ChevronRight, Bookmark, Trash2, Upload } from 'lucide-react'
import clsx from 'clsx'

const ROLE_LABEL: Record<string,string> = {
  ADMIN:'관리자', HQ_CHIEF:'본부장', HQ_MEMBER:'본부멤버', BIZ_REP:'사업장대표', ETC:'기타'
}

const DOC_TYPES = [
  { value: 'expense',       label: '지출품의서',  desc: '물품구매, 행사비 등 지출' },
  { value: 'purchase',      label: '구매요청서',  desc: '비품/소모품 구매' },
  { value: 'trip',          label: '출장품의서',  desc: '출장 일정 및 비용' },
  { value: 'entertainment', label: '접대비품의서', desc: '접대비 집행' },
  { value: 'general',       label: '일반품의서',  desc: '기타 업무 품의' },
] as const

const DOC_TEMPLATES: Record<string, {purpose:string; content:string; payMethod:string}> = {
  expense:       { purpose: '업무 추진을 위한 지출 품의', content: '1. 지출 목적:\n\n2. 지출 내역:\n\n3. 산출 근거:', payMethod: '법인카드 / 계좌이체' },
  purchase:      { purpose: '업무용 물품 구매 요청', content: '1. 구매 목적:\n\n2. 품목 및 규격:\n\n3. 구매 사유:\n\n4. 선정 업체:', payMethod: '계좌이체' },
  trip:          { purpose: '업무 출장 품의', content: '1. 출장 목적:\n\n2. 출장 일정:\n   - 기간:\n   - 출장지:\n   - 동행자:\n\n3. 교통편:', payMethod: '현금 지급' },
  entertainment: { purpose: '접대비 집행 품의', content: '1. 접대 일시:\n\n2. 접대 대상:\n\n3. 접대 사유:\n\n4. 장소:', payMethod: '법인카드' },
  general:       { purpose: '', content: '1. 배경 및 목적:\n\n2. 세부 내용:\n\n3. 관련 사항:', payMethod: '' },
}

function InternalNewInner() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const copyFromId = searchParams.get('copyFrom')

  const [step,         setStep]         = useState<'type'|'line'|'write'>('type')
  const [allUsers,     setAllUsers]     = useState<AppUser[]>([])
  const [lines,        setLines]        = useState<ApprovalLine[]>([])
  const [allDocs,      setAllDocs]      = useState<InternalDoc[]>([])
  const [seals,        setSeals]        = useState<OfficialSeal[]>([])

  // 문서 유형
  const [docType, setDocType] = useState<InternalDoc['docType']>('expense')

  // 결재선
  const [midApprovers,  setMidApprovers]  = useState<{uid:string;name:string;role:string}[]>([])
  const [finalApprover, setFinalApprover] = useState<{uid:string;name:string;role:string}|null>(null)
  const [selectedSeal,  setSelectedSeal]  = useState<OfficialSeal|null>(null)

  // 문서 내용
  const [docNo,        setDocNo]        = useState('')
  const [title,        setTitle]        = useState('')
  const [dept,         setDept]         = useState('')
  const [purpose,      setPurpose]      = useState('')
  const [content,      setContent]      = useState('')
  const [budgetItems,  setBudgetItems]  = useState<BudgetItem[]>([
    { item:'', qty:1, unitPrice:0, amount:0 }
  ])
  const [payMethod,    setPayMethod]    = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [effect,       setEffect]       = useState('')
  const [attachFiles,  setAttachFiles]  = useState<{name:string;url:string;size?:number}[]>([])
  const [uploading,    setUploading]    = useState(false)
  const [saving,       setSaving]       = useState(false)

  const attachRef = useRef<HTMLInputElement>(null)

  const isHQ = user && ['ADMIN','HQ_CHIEF','HQ_MEMBER'].includes(user.role)

  useEffect(() => {
    if (loading) return
    if (!user || !isHQ) { router.replace('/dashboard'); return }
    const u1 = listenUsers(setAllUsers)
    const u2 = listenApprovalLines(user.uid, setLines)
    const u3 = listenInternalDocs(user.uid, setAllDocs)
    const u4 = listenOfficialSeals(setSeals)
    return () => { u1(); u2(); u3(); u4() }
  }, [user, loading, isHQ, router])

  // 복사해서 새로 작성
  useEffect(() => {
    if (!copyFromId || !allDocs.length) return
    const src = allDocs.find(d => d.id === copyFromId)
    if (!src) return
    setDocType(src.docType)
    setTitle(src.title)
    setDept(src.dept)
    setPurpose(src.purpose)
    setContent(src.content)
    setBudgetItems(src.budgetItems?.length ? src.budgetItems : [{ item:'', qty:1, unitPrice:0, amount:0 }])
    setPayMethod(src.payMethod ?? '')
    setEffect(src.effect ?? '')
    setStep('line')
  }, [copyFromId, allDocs])

  const hqUsers = allUsers.filter(u =>
    ['ADMIN','HQ_CHIEF','HQ_MEMBER'].includes(u.role) && u.uid !== user?.uid
  )

  const outgoingLines = lines.filter(l => l.lineType === 'outgoing')

  const applyTemplate = () => {
    const tpl = DOC_TEMPLATES[docType]
    if (!purpose) setPurpose(tpl.purpose)
    if (!content) setContent(tpl.content)
    if (!payMethod) setPayMethod(tpl.payMethod)
  }

  const updateBudgetItem = (i: number, field: keyof BudgetItem, val: string | number) => {
    setBudgetItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      const updated = { ...item, [field]: val }
      if (field === 'qty' || field === 'unitPrice') {
        updated.amount = Number(updated.qty) * Number(updated.unitPrice)
      }
      return updated
    }))
  }

  const totalAmount = budgetItems.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
  const formatMoney = (n: number) => n.toLocaleString('ko-KR')

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return
    const files = Array.from(e.target.files ?? []) as File[]
    if (attachFiles.length + files.length > 10) { alert('최대 10개'); return }
    setUploading(true)
    try {
      const uploaded = await Promise.all(files.map(async (f: File) => {
        const { path, url, size } = await uploadAttachment(f, user.uid)
        return { name: f.name, url, size, path }
      }))
      setAttachFiles(prev => [...prev, ...uploaded])
    } catch(err) { console.error(err) }
    finally { setUploading(false); if (attachRef.current) attachRef.current.value = '' }
  }

  const handleSubmit = async (isDraft = false) => {
    if (!user) return
    if (!title.trim()) { alert('제목을 입력해주세요'); return }
    if (!isDraft && !finalApprover) { alert('최종결재자를 선택해주세요'); return }
    setSaving(true)
    try {
      const drafter: Approver = {
        uid: user.uid, name: user.name, role: '기안자',
        status: 'submitted', actedAt: new Date().toISOString()
      }
      const approversList: Approver[] = midApprovers.map(a => ({ ...a, status: 'waiting' as const }))
      const final: Approver = finalApprover
        ? { ...finalApprover, status: 'waiting' }
        : { uid: user.uid, name: user.name, role: '최종결재', status: 'waiting' }

      await createInternalDoc({
        docType, docNo, title, dept, purpose, content,
        budgetItems: budgetItems.filter(b => b.item.trim()),
        totalAmount,
        payMethod, expectedDate: expectedDate || undefined,
        effect: effect || undefined,
        attachments: attachFiles,
        drafter, approvers: approversList, finalApprover: final,
        status: isDraft ? 'draft' : 'pending',
        authorUid: user.uid,
        approvedAt: undefined, rejectedAt: undefined,
      })

      if (!isDraft) {
        const first = approversList[0] ?? final
        setTimeout(() => {
          fetch('/api/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer hq-cleanup-2026' },
            body: JSON.stringify({
              title: '📋 품의서 결재 요청',
              body: `${user.name}님이 "${title}" 품의서 결재를 요청했습니다`,
              url: '/approval',
              targetUids: [first.uid],
            }),
          }).catch(() => {})
        }, 0)
      }
      router.push('/approval')
    } catch(e) { console.error(e); alert('저장 중 오류가 발생했습니다') }
    finally { setSaving(false) }
  }

  // ── Step 1: 문서 유형 선택 ──────────────────────────
  if (step === 'type') return (
    <ApprovalShell title="내부 품의서">
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">품의서 유형 선택</h2>
          <p className="text-sm text-gray-500 mt-1">작성할 품의서 유형을 선택해주세요</p>
        </div>
        <div className="space-y-2">
          {DOC_TYPES.map(t => (
            <button key={t.value} onClick={() => { setDocType(t.value); applyTemplate() }}
              className={clsx('w-full flex items-center gap-4 px-5 py-4 border-2 rounded-2xl transition-all text-left',
                docType === t.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50')}>
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0',
                docType === t.value ? 'bg-primary-100' : 'bg-gray-100')}>
                {t.value === 'expense' ? '💰' : t.value === 'purchase' ? '🛒' : t.value === 'trip' ? '✈️' : t.value === 'entertainment' ? '🍽️' : '📝'}
              </div>
              <div>
                <p className={clsx('font-semibold', docType === t.value ? 'text-primary-800' : 'text-gray-800')}>{t.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
              </div>
              {docType === t.value && <span className="ml-auto text-primary-500 text-lg">✓</span>}
            </button>
          ))}
        </div>
        <button onClick={() => { applyTemplate(); setStep('line') }}
          className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-800 transition-colors flex items-center justify-center gap-2">
          다음 — 결재선 설정 <ChevronRight size={18}/>
        </button>
      </div>
    </ApprovalShell>
  )

  // ── Step 2: 결재선 설정 ─────────────────────────────
  if (step === 'line') return (
    <ApprovalShell title="내부 품의서">
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        {/* 저장된 결재선 */}
        {outgoingLines.length > 0 && (
          <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-primary-700 mb-2 flex items-center gap-1"><Bookmark size={12}/> 저장된 결재선</p>
            <div className="flex flex-wrap gap-2">
              {outgoingLines.map(line => (
                <button key={line.id}
                  onClick={() => { setMidApprovers(line.approvers); setFinalApprover(line.finalApprover) }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-primary-200 rounded-xl text-xs text-primary-700 hover:bg-primary-100 transition-colors">
                  {line.name} <span className="text-primary-400">({line.approvers.length + 1}명)</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">결재선 설정</h2>
            <button onClick={() => setStep('type')} className="text-xs text-gray-400 hover:text-gray-600">← 유형 변경</button>
          </div>

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
            {midApprovers.map((a, i) => (
              <div key={a.uid} className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl mb-2">
                <span className="text-xs text-gray-400 w-4">{i+1}</span>
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">{a.name[0]}</div>
                <div className="flex-1"><p className="text-sm font-medium">{a.name}</p><p className="text-xs text-gray-400">{a.role}</p></div>
                <button onClick={() => setMidApprovers(p => p.filter((_,j) => j !== i))}><X size={14} className="text-gray-300 hover:text-red-400"/></button>
              </div>
            ))}
            {midApprovers.length < 5 && (
              <div className="grid grid-cols-2 gap-2">
                {hqUsers.filter(u => !midApprovers.some(a => a.uid === u.uid) && u.uid !== finalApprover?.uid).map(u => (
                  <button key={u.uid}
                    onClick={() => setMidApprovers(p => [...p, { uid:u.uid, name:u.name, role:ROLE_LABEL[u.role]??u.role }])}
                    className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-colors text-left">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold">{u.name[0]}</div>
                    <div className="min-w-0"><p className="text-xs font-medium text-gray-700 truncate">{u.name}</p><p className="text-xs text-gray-400">{ROLE_LABEL[u.role]}</p></div>
                    <Plus size={12} className="text-gray-400 ml-auto shrink-0"/>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 최종결재자 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">최종결재자 <span className="text-red-400">*</span> <span className="text-gray-300 font-normal">(보통 본부장)</span></p>
            {finalApprover ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center text-xs font-bold text-green-800">{finalApprover.name[0]}</div>
                <div className="flex-1"><p className="text-sm font-medium text-green-900">{finalApprover.name}</p><p className="text-xs text-green-600">{finalApprover.role}</p></div>
                <button onClick={() => setFinalApprover(null)}><X size={14} className="text-green-300 hover:text-red-400"/></button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {hqUsers.filter(u => !midApprovers.some(a => a.uid === u.uid)).map(u => (
                  <button key={u.uid}
                    onClick={() => setFinalApprover({ uid:u.uid, name:u.name, role:ROLE_LABEL[u.role]??u.role })}
                    className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:bg-green-50 transition-colors text-left">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold">{u.name[0]}</div>
                    <div className="min-w-0"><p className="text-xs font-medium text-gray-700 truncate">{u.name}</p><p className="text-xs text-gray-400">{ROLE_LABEL[u.role]}</p></div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button onClick={() => { if (!finalApprover) { alert('최종결재자를 선택해주세요'); return } setStep('write') }}
          className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-800 transition-colors flex items-center justify-center gap-2">
          다음 — 품의서 작성 <ChevronRight size={18}/>
        </button>
      </div>
    </ApprovalShell>
  )

  // ── Step 3: 품의서 작성 ─────────────────────────────
  const selectedType = DOC_TYPES.find(t => t.value === docType)

  return (
    <ApprovalShell title="내부 품의서">
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        {/* 품의서 미리보기 (인쇄용 양식) */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* 양식 헤더 */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg">{selectedType?.value === 'expense' ? '💰' : selectedType?.value === 'purchase' ? '🛒' : selectedType?.value === 'trip' ? '✈️' : selectedType?.value === 'entertainment' ? '🍽️' : '📝'}</span>
              <h2 className="font-bold text-gray-900">{selectedType?.label}</h2>
            </div>
            <button onClick={() => setStep('line')} className="text-xs text-gray-400 hover:text-gray-600">← 결재선 변경</button>
          </div>

          <div className="p-6 space-y-5">
            {/* 결재란 미리보기 */}
            <div className="flex border border-gray-300 rounded-xl overflow-hidden">
              {[user, ...midApprovers, finalApprover].filter(Boolean).map((a, i) => {
                const name = 'name' in (a as AppUser) ? (a as AppUser).name : (a as {name:string}).name
                const role = i === 0 ? '기안자' : i === [user, ...midApprovers, finalApprover].filter(Boolean).length - 1 ? '최종결재' : `결재${i}`
                return (
                  <div key={i} className={clsx('flex-1 text-center py-3 px-2', i < [user,...midApprovers,finalApprover].filter(Boolean).length-1 && 'border-r border-gray-200')}>
                    <p className="text-xs text-gray-400 mb-1">{role}</p>
                    <div className="h-8 flex items-center justify-center">
                      <p className="text-sm font-medium text-gray-800">{name}</p>
                    </div>
                    <p className="text-xs text-gray-300 mt-1">서명</p>
                  </div>
                )
              })}
            </div>

            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label:'부서명', value:dept, set:setDept, ph:'예: 기획운영본부' },
                { label:'문서번호', value:docNo, set:setDocNo, ph:'예: 품의-2026-001' },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-xs font-medium text-gray-500 block mb-1">{f.label}</label>
                  <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                </div>
              ))}
            </div>

            {/* 제목 */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">제목 *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="품의 제목을 입력하세요"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-400"/>
            </div>

            {/* 목적/사유 */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">목적 / 사유</label>
              <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="품의 목적 또는 사유"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
            </div>

            {/* 상세 내용 */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">상세 내용</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={6}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
            </div>

            {/* 예산 항목 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500">예산 항목</label>
                <button onClick={() => setBudgetItems(p => [...p, { item:'', qty:1, unitPrice:0, amount:0 }])}
                  className="text-xs text-primary-600 flex items-center gap-1 hover:text-primary-800">
                  <Plus size={11}/> 항목 추가
                </button>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">
                  <span className="col-span-4">항목</span>
                  <span className="col-span-2 text-center">수량</span>
                  <span className="col-span-3 text-right">단가</span>
                  <span className="col-span-2 text-right">금액</span>
                  <span className="col-span-1"/>
                </div>
                {budgetItems.map((b, i) => (
                  <div key={i} className="grid grid-cols-12 gap-1 px-3 py-2 border-b border-gray-50 last:border-0 items-center">
                    <input value={b.item} onChange={e => updateBudgetItem(i, 'item', e.target.value)}
                      placeholder="항목명" className="col-span-4 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"/>
                    <input type="number" value={b.qty} onChange={e => updateBudgetItem(i, 'qty', Number(e.target.value))}
                      className="col-span-2 border border-gray-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary-400"/>
                    <input type="number" value={b.unitPrice} onChange={e => updateBudgetItem(i, 'unitPrice', Number(e.target.value))}
                      className="col-span-3 border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-primary-400"/>
                    <span className="col-span-2 text-xs text-right text-gray-700 font-medium">{formatMoney(b.amount)}</span>
                    <button onClick={() => setBudgetItems(p => p.filter((_,j) => j !== i))} className="col-span-1 flex justify-center">
                      <Trash2 size={12} className="text-gray-300 hover:text-red-400"/>
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-12 px-3 py-2 bg-primary-50 border-t border-primary-100">
                  <span className="col-span-9 text-xs font-semibold text-primary-700">합 계</span>
                  <span className="col-span-3 text-sm font-bold text-primary-800 text-right">{formatMoney(totalAmount)}원</span>
                </div>
              </div>
            </div>

            {/* 지급방법 + 예정일 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">지급방법</label>
                <input value={payMethod} onChange={e => setPayMethod(e.target.value)} placeholder="예: 법인카드, 계좌이체"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">지급예정일</label>
                <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
              </div>
            </div>

            {/* 기대효과 */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">기대효과 / 비고</label>
              <textarea value={effect} onChange={e => setEffect(e.target.value)} rows={2} placeholder="기대효과 또는 참고사항"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
            </div>

            {/* 첨부파일 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500">첨부파일 ({attachFiles.length}/10)</label>
                <button onClick={() => attachRef.current?.click()} disabled={uploading || attachFiles.length >= 10}
                  className="text-xs text-primary-600 flex items-center gap-1 disabled:opacity-40">
                  <Upload size={11}/> {uploading ? '업로드 중...' : '파일 첨부'}
                </button>
              </div>
              <input ref={attachRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.bmp,.hwp,.hwpx,.doc,.docx,.xls,.xlsx" onChange={handleAttach} className="hidden"/>
              {attachFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 mb-1 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                  <span className="text-xs text-blue-700 flex-1 truncate">📎 {f.name}</span>
                  {f.size && <span className="text-xs text-gray-400">{(f.size/1024).toFixed(0)}KB</span>}
                  <button onClick={() => setAttachFiles(p => p.filter((_,j) => j !== i))}>
                    <Trash2 size={12} className="text-gray-300 hover:text-red-400"/>
                  </button>
                </div>
              ))}
              <p className="text-xs text-gray-400 mt-1">PDF, JPG, HWP, HWPX, Excel 등 · 최대 10개</p>
            </div>
          </div>
        </div>

        {/* 제출 버튼 */}
        <div className="flex gap-2 pb-4">
          <button onClick={() => handleSubmit(true)} disabled={saving}
            className="flex-1 py-3.5 border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50">
            임시저장
          </button>
          <button onClick={() => handleSubmit(false)} disabled={saving || !title.trim()}
            className="flex-1 py-3.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
            {saving ? '제출 중...' : '결재 상신'}
          </button>
        </div>
      </div>
    </ApprovalShell>
  )
}

export default function InternalNewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"/></div>}>
      <InternalNewInner/>
    </Suspense>
  )
}
