'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenUsers, listenApprovalLines, saveApprovalLine, deleteApprovalLine } from '@/lib/db'
import type { AppUser, ApprovalLine } from '@/types'
import { Plus, Trash2, X, Bookmark } from 'lucide-react'
import clsx from 'clsx'

const ROLE_LABEL: Record<string,string> = {
  ADMIN:'관리자', HQ_CHIEF:'본부장', HQ_MEMBER:'본부멤버', BIZ_REP:'사업장대표', ETC:'기타'
}

export default function ApprovalLinesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [allUsers,  setAllUsers]  = useState<AppUser[]>([])
  const [lines,     setLines]     = useState<ApprovalLine[]>([])

  // 새 결재선 폼
  const [lineName,      setLineName]      = useState('')
  const [midApprovers,  setMidApprovers]  = useState<{uid:string;name:string;role:string}[]>([])
  const [finalApprover, setFinalApprover] = useState<{uid:string;name:string;role:string}|null>(null)
  const [saving,        setSaving]        = useState(false)
  const [showForm,      setShowForm]      = useState(false)

  const isHQ = user && ['ADMIN','HQ_CHIEF','HQ_MEMBER'].includes(user.role)

  useEffect(() => {
    if (loading) return
    if (!user || !isHQ) { router.replace('/settings'); return }
    const u1 = listenUsers(setAllUsers)
    const u2 = listenApprovalLines(user.uid, setLines)
    return () => { u1(); u2() }
  }, [user, loading, isHQ, router])

  const hqUsers = allUsers.filter(u =>
    ['ADMIN','HQ_CHIEF','HQ_MEMBER'].includes(u.role) && u.uid !== user?.uid
  )

  const handleSave = async () => {
    if (!user || !lineName.trim() || !finalApprover) {
      alert('결재선 이름과 최종결재자를 입력해주세요'); return
    }
    setSaving(true)
    await saveApprovalLine({
      name: lineName.trim(),
      approvers: midApprovers,
      finalApprover,
      ownerUid: user.uid,
    })
    setLineName(''); setMidApprovers([]); setFinalApprover(null)
    setShowForm(false); setSaving(false)
  }

  return (
    <AppShell title="결재선 관리" back="/settings">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">자주 쓰는 결재선을 저장해두면 기안/접수 시 바로 불러올 수 있습니다</p>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-800 transition-colors">
            <Plus size={15}/> 새 결재선
          </button>
        </div>

        {/* 새 결재선 폼 */}
        {showForm && (
          <div className="bg-white border border-primary-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-900 text-sm">새 결재선 추가</h3>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">결재선 이름 *</label>
              <input value={lineName} onChange={e => setLineName(e.target.value)}
                placeholder="예: 일반결재, 긴급결재"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">중간 결재자 <span className="font-normal text-gray-300">({midApprovers.length}/5)</span></p>
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

            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50">취소</button>
              <button onClick={handleSave} disabled={saving || !lineName.trim() || !finalApprover}
                className="flex-1 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
                {saving ? '저장 중...' : '결재선 저장'}
              </button>
            </div>
          </div>
        )}

        {/* 저장된 결재선 목록 */}
        {lines.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Bookmark size={36} className="mx-auto mb-3 opacity-30"/>
            <p className="text-sm">저장된 결재선이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lines.map(line => (
              <div key={line.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bookmark size={14} className="text-primary-500"/>
                    <span className="font-semibold text-gray-900 text-sm">{line.name}</span>
                  </div>
                  <button onClick={async () => {
                    if (!confirm(`"${line.name}" 결재선을 삭제하시겠습니까?`)) return
                    await deleteApprovalLine(line.id)
                  }} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={15}/>
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">접수자</span>
                  <span className="text-gray-300 text-xs">→</span>
                  {line.approvers.map((a, i) => (
                    <span key={i} className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-full">{a.name}</span>
                  ))}
                  {line.approvers.length > 0 && <span className="text-gray-300 text-xs">→</span>}
                  <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium">{line.finalApprover.name} (최종)</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
