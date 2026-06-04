'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import {
  listenUsers, listenApprovalLines,
  createIncomingDoc, listenIncomingDocs
} from '@/lib/db'
import { uploadImage } from '@/lib/upload'
import { storage } from '@/lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import type { AppUser, ApprovalLine, Approver, IncomingDoc } from '@/types'
import { Plus, X, Upload, ChevronRight, Bookmark } from 'lucide-react'
import clsx from 'clsx'

const ROLE_LABEL: Record<string,string> = {
  ADMIN:'관리자', HQ_CHIEF:'본부장', HQ_MEMBER:'본부멤버', BIZ_REP:'사업장대표', ETC:'기타'
}

function IncomingNewInner() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [allUsers,  setAllUsers]  = useState<AppUser[]>([])
  const [lines,     setLines]     = useState<ApprovalLine[]>([])
  const [step,      setStep]      = useState<'line'|'write'>('line')

  // 결재선
  const [midApprovers,  setMidApprovers]  = useState<{uid:string;name:string;role:string}[]>([])
  const [finalApprover, setFinalApprover] = useState<{uid:string;name:string;role:string}|null>(null)

  // 문서 정보
  const [docNo,      setDocNo]      = useState('')
  const [title,      setTitle]      = useState('')
  const [sender,     setSender]     = useState('')
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0,10))
  const [hasDueDate, setHasDueDate] = useState(false)
  const [dueDate,    setDueDate]    = useState('')
  const [memo,       setMemo]       = useState('')
  const [pdfFile,    setPdfFile]    = useState<File|null>(null)
  const [pdfName,    setPdfName]    = useState('')
  const [saving,     setSaving]     = useState(false)

  const pdfRef = useRef<HTMLInputElement>(null)
  const isHQ = user && ['ADMIN','HQ_CHIEF','HQ_MEMBER'].includes(user.role)

  useEffect(() => {
    if (loading) return
    if (!user || !isHQ) { router.replace('/dashboard'); return }
    const u1 = listenUsers(setAllUsers)
    const u2 = listenApprovalLines(user.uid, setLines)
    return () => { u1(); u2() }
  }, [user, loading, isHQ, router])

  const hqUsers = allUsers.filter(u =>
    ['ADMIN','HQ_CHIEF','HQ_MEMBER'].includes(u.role) && u.uid !== user?.uid
  )

  const applyLine = (line: ApprovalLine) => {
    setMidApprovers(line.approvers)
    setFinalApprover(line.finalApprover)
  }

  const handlePdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setPdfFile(f)
    setPdfName(f.name)
  }

  const handleSubmit = async () => {
    if (!user) return
    if (!title.trim()) { alert('제목을 입력해주세요'); return }
    if (!sender.trim()) { alert('발신기관을 입력해주세요'); return }
    if (!finalApprover) { alert('최종결재자를 선택해주세요'); return }
    setSaving(true)
    try {
      let pdfUrl = ''
      if (pdfFile) {
        const storageRef = ref(storage, `incomingDocs/${user.uid}_${Date.now()}_${pdfFile.name}`)
        await uploadBytes(storageRef, pdfFile, { contentType: 'application/pdf' })
        pdfUrl = await getDownloadURL(storageRef)
      }

      const receiver: Approver = {
        uid: user.uid, name: user.name, role: '접수자',
        status: 'submitted', actedAt: new Date().toISOString()
      }
      const approversList: Approver[] = midApprovers.map(a => ({ ...a, status: 'waiting' as const }))
      const final: Approver = { ...finalApprover, status: 'waiting' }

      const docRef = await createIncomingDoc({
        docNo, title, sender, receivedAt,
        hasDueDate, dueDate: hasDueDate ? dueDate : undefined,
        memo: memo.trim() || undefined,
        pdfUrl: pdfUrl || undefined,
        pdfName: pdfName || undefined,
        receiver, approvers: approversList, finalApprover: final,
        status: 'pending', authorUid: user.uid,
        approvedAt: undefined, rejectedAt: undefined,
      })

      // 첫 결재자에게 알림
      const first = approversList[0] ?? final
      setTimeout(() => {
        fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer hq-cleanup-2026' },
          body: JSON.stringify({
            title: '📨 공문 접수 결재 요청',
            body: `${user.name}님이 "${title}" 공문 접수 결재를 요청했습니다`,
            url: '/approval',
            targetUids: [first.uid],
          }),
        }).catch(() => {})
      }, 0)

      router.push('/approval?tab=incoming')
    } catch(e) {
      console.error(e); alert('저장 중 오류가 발생했습니다')
    } finally { setSaving(false) }
  }

  // ── Step 1: 결재선 ──────────────────────────────────
  if (step === 'line') return (
    <AppShell title="공문 접수" back="/approval">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5">
          <h2 className="font-semibold text-gray-900">결재선 설정</h2>

          {/* 접수자 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">접수자</p>
            <div className="flex items-center gap-3 px-4 py-3 bg-primary-50 border border-primary-200 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-primary-200 flex items-center justify-center text-xs font-bold text-primary-800">{user?.name?.[0]}</div>
              <div><p className="text-sm font-medium text-primary-900">{user?.name}</p><p className="text-xs text-primary-500">접수자 (본인)</p></div>
            </div>
          </div>

          {/* 검토자 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">검토자 <span className="font-normal text-gray-300">({midApprovers.length}/3, 선택)</span></p>
            {midApprovers.map((a, i) => (
              <div key={a.uid} className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl mb-2">
                <span className="text-xs text-gray-400 w-4">{i+1}</span>
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold">{a.name[0]}</div>
                <div className="flex-1"><p className="text-sm font-medium">{a.name}</p><p className="text-xs text-gray-400">{a.role}</p></div>
                <button onClick={() => setMidApprovers(p => p.filter((_,j) => j !== i))}><X size={14} className="text-gray-300 hover:text-red-400"/></button>
              </div>
            ))}
            {midApprovers.length < 3 && (
              <div className="grid grid-cols-2 gap-2">
                {hqUsers.filter(u => !midApprovers.some(a => a.uid === u.uid) && u.uid !== finalApprover?.uid).map(u => (
                  <button key={u.uid}
                    onClick={() => setMidApprovers(p => [...p, { uid:u.uid, name:u.name, role:ROLE_LABEL[u.role]??u.role }])}
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
                {hqUsers.filter(u => !midApprovers.some(a => a.uid === u.uid)).map(u => (
                  <button key={u.uid}
                    onClick={() => setFinalApprover({ uid:u.uid, name:u.name, role:ROLE_LABEL[u.role]??u.role })}
                    className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:bg-green-50 transition-colors text-left">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">{u.name[0]}</div>
                    <div className="min-w-0"><p className="text-xs font-medium text-gray-700 truncate">{u.name}</p><p className="text-xs text-gray-400">{ROLE_LABEL[u.role]}</p></div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button onClick={() => { if (!finalApprover) { alert('최종결재자를 선택해주세요'); return } setStep('write') }}
          className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-800 transition-colors flex items-center justify-center gap-2">
          다음 — 공문 정보 입력 <ChevronRight size={18}/>
        </button>
      </div>
    </AppShell>
  )

  // ── Step 2: 공문 정보 입력 ───────────────────────────
  return (
    <AppShell title="공문 접수" back="/approval">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">공문 정보</h2>

          {[
            { label:'발신기관 *', value:sender,     set:setSender,     ph:'예: 문화체육관광부' },
            { label:'문서번호',   value:docNo,       set:setDocNo,      ph:'예: 종무2담당관-2942' },
            { label:'제목 *',     value:title,       set:setTitle,      ph:'공문 제목을 입력하세요', bold:true },
          ].map(f => (
            <div key={f.label}>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">{f.label}</label>
              <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                className={clsx('w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400', (f as {bold?:boolean}).bold && 'font-semibold')}/>
            </div>
          ))}

          {/* 수신일자 */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">수신일자 *</label>
            <input type="date" value={receivedAt} onChange={e => setReceivedAt(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
          </div>

          {/* 처리기한 */}
          <div>
            <button onClick={() => setHasDueDate(v => !v)}
              className={clsx('w-full flex items-center gap-3 px-4 py-3 border rounded-xl transition-colors',
                hasDueDate ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 hover:bg-gray-50')}>
              <span className="text-lg">{hasDueDate ? '⏰' : '📅'}</span>
              <div className="flex-1 text-left">
                <p className={clsx('text-sm font-medium', hasDueDate ? 'text-red-800' : 'text-gray-700')}>처리기한 설정</p>
                <p className="text-xs text-gray-400">기한 1일 전 자동 알림</p>
              </div>
              <div className={clsx('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                hasDueDate ? 'border-red-500 bg-red-500' : 'border-gray-300')}>
                {hasDueDate && <span className="text-white text-xs font-bold">✓</span>}
              </div>
            </button>
            {hasDueDate && (
              <div className="mt-2">
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  min={receivedAt}
                  className="w-full border border-red-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"/>
              </div>
            )}
          </div>

          {/* PDF 첨부 */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">공문 파일 첨부 (PDF)</label>
            <input ref={pdfRef} type="file" accept=".pdf,application/pdf" onChange={handlePdf} className="hidden"/>
            <button onClick={() => pdfRef.current?.click()}
              className={clsx('w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed rounded-xl text-sm transition-colors',
                pdfFile ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-300 text-gray-500 hover:border-primary-400 hover:text-primary-600')}>
              <Upload size={16}/>
              {pdfFile ? `✓ ${pdfName}` : 'PDF 파일 선택'}
            </button>
            <p className="text-xs text-gray-400 mt-1">스캔본 또는 전자문서 PDF</p>
          </div>

          {/* 비고 */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">비고</label>
            <textarea value={memo} onChange={e => setMemo(e.target.value)}
              placeholder="처리 지시사항 등 (선택)" rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"/>
          </div>
        </div>

        {/* 결재선 요약 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-2 font-medium">결재선</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">{user?.name} (접수)</span>
            {midApprovers.map(a => (
              <span key={a.uid} className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{a.name}</span>
            ))}
            {finalApprover && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">{finalApprover.name} (최종)</span>
            )}
          </div>
        </div>

        <button onClick={handleSubmit} disabled={saving || !title.trim() || !sender.trim()}
          className="w-full py-3.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 transition-colors">
          {saving ? '접수 중...' : '공문 접수 결재 상신'}
        </button>
      </div>
    </AppShell>
  )
}

export default function IncomingNewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"/></div>}>
      <IncomingNewInner/>
    </Suspense>
  )
}
