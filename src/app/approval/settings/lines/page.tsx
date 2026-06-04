'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ApprovalShell from '@/components/ApprovalShell'
import { useAuth } from '@/lib/auth-context'
import { listenUsers, listenApprovalLines, saveApprovalLine, deleteApprovalLine } from '@/lib/db'
import type { AppUser, ApprovalLine, ApprovalLineType } from '@/types'
import { Plus, Trash2, X, Bookmark, FilePlus, FileInput } from 'lucide-react'
import clsx from 'clsx'

const ROLE_LABEL: Record<string,string> = {
  ADMIN:'관리자', HQ_CHIEF:'본부장', HQ_MEMBER:'본부멤버', BIZ_REP:'사업장대표', ETC:'기타'
}

export default function ApprovalLinesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [allUsers,  setAllUsers]  = useState<AppUser[]>([])
  const [lines,     setLines]     = useState<ApprovalLine[]>([])
  const [activeTab, setActiveTab] = useState<ApprovalLineType>('outgoing')
  const [showForm,  setShowForm]  = useState(false)
  const [lineName,  setLineName]  = useState('')
  const [midApprovers,  setMidApprovers]  = useState<{uid:string;name:string;role:string}[]>([])
  const [finalApprover, setFinalApprover] = useState<{uid:string;name:string;role:string}|null>(null)
  const [saving, setSaving] = useState(false)

  const isHQ = user && ['ADMIN','HQ_CHIEF','HQ_MEMBER'].includes(user.role)
  useEffect(() => {
    if (loading) return
    if (!user || !isHQ) { router.replace('/approval'); return }
    const u1 = listenUsers(setAllUsers)
    const u2 = listenApprovalLines(user.uid, setLines)
    return () => { u1(); u2() }
  }, [user, loading, isHQ, router])

  const hqUsers = allUsers.filter(u =>
    ['ADMIN','HQ_CHIEF','HQ_MEMBER'].includes(u.role) && u.uid !== user?.uid
  )

  const tabLines = lines.filter(l => l.lineType === activeTab)
  const canAdd = tabLines.length < 3

  const handleSave = async () => {
    if (!user || !lineName.trim() || !finalApprover) { alert('이름과 최종결재자를 입력해주세요'); return }
    if (!canAdd) { alert(`${activeTab === 'outgoing' ? '발신' : '수신'}용 결재선은 최대 3개까지 저장할 수 있습니다`); return }
    setSaving(true)
    await saveApprovalLine({ name:lineName.trim(), lineType:activeTab, approvers:midApprovers, finalApprover, ownerUid:user.uid })
    setLineName(''); setMidApprovers([]); setFinalApprover(null); setShowForm(false); setSaving(false)
  }

  return (
    <ApprovalShell title="결재선 관리">
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">결재선 관리</h2>
          <p className="text-sm text-gray-500 mt-1">발신/수신 각 3개까지 저장 가능합니다</p>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([['outgoing','발신용 결재선',FilePlus],['incoming','수신용 결재선',FileInput]] as const).map(([t,l,Icon]) => (
            <button key={t} onClick={() => { setActiveTab(t); setShowForm(false) }}
              className={clsx('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab===t ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500')}>
              <Icon size={14}/>{l}
              <span className={clsx('text-xs px-1.5 py-0.5 rounded-full', activeTab===t ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-500')}>
                {lines.filter(l=>l.lineType===t).length}/3
              </span>
            </button>
          ))}
        </div>

        {/* 추가 버튼 */}
        {canAdd && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors">
            <Plus size={15}/> {activeTab==='outgoing' ? '발신용' : '수신용'} 결재선 추가
          </button>
        )}
        {!canAdd && (
          <p className="text-xs text-center text-gray-400 bg-gray-50 rounded-xl py-3">최대 3개까지 저장됩니다. 기존 결재선을 삭제 후 추가하세요.</p>
        )}

        {/* 추가 폼 */}
        {showForm && (
          <div className="bg-white border border-primary-200 rounded-2xl p-5 space-y-4">
            <h3 className="font-semibold text-sm text-gray-900">
              {activeTab==='outgoing' ? '📤 발신용' : '📥 수신용'} 결재선 추가
            </h3>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1.5">결재선 이름 *</label>
              <input value={lineName} onChange={e=>setLineName(e.target.value)}
                placeholder="예: 일반결재, 긴급결재"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {activeTab==='outgoing' ? '기안자 (본인) → 중간결재자 → 최종결재자' : '접수자 (본인) → 중간결재자 → 최종결재자'}
              </p>
              <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 rounded-lg mb-2 text-xs text-primary-700">
                <div className="w-6 h-6 rounded-full bg-primary-200 flex items-center justify-center font-bold text-primary-800 shrink-0">{user?.name?.[0]}</div>
                {user?.name} ({activeTab==='outgoing' ? '기안자' : '접수자'}) - 자동
              </div>
              {midApprovers.map((a,i) => (
                <div key={a.uid} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg mb-2">
                  <span className="text-xs text-gray-400 w-4">{i+1}</span>
                  <div className="flex-1 text-sm">{a.name} <span className="text-xs text-gray-400">{a.role}</span></div>
                  <button onClick={() => setMidApprovers(p=>p.filter((_,j)=>j!==i))}><X size={13} className="text-gray-300 hover:text-red-400"/></button>
                </div>
              ))}
              {midApprovers.length < 5 && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {hqUsers.filter(u => !midApprovers.some(a=>a.uid===u.uid) && u.uid!==finalApprover?.uid).map(u => (
                    <button key={u.uid} onClick={() => setMidApprovers(p=>[...p,{uid:u.uid,name:u.name,role:ROLE_LABEL[u.role]??u.role}])}
                      className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors text-left">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold shrink-0">{u.name[0]}</div>
                      <div className="min-w-0"><p className="text-xs font-medium text-gray-700 truncate">{u.name}</p><p className="text-xs text-gray-400">{ROLE_LABEL[u.role]}</p></div>
                      <Plus size={11} className="text-gray-400 ml-auto shrink-0"/>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs font-semibold text-gray-400 mb-2">최종결재자 *</p>
              {finalApprover ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex-1 text-sm text-green-900">{finalApprover.name} <span className="text-xs text-green-600">{finalApprover.role}</span></div>
                  <button onClick={()=>setFinalApprover(null)}><X size={13} className="text-green-300 hover:text-red-400"/></button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {hqUsers.filter(u=>!midApprovers.some(a=>a.uid===u.uid)).map(u=>(
                    <button key={u.uid} onClick={()=>setFinalApprover({uid:u.uid,name:u.name,role:ROLE_LABEL[u.role]??u.role})}
                      className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors text-left">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold shrink-0">{u.name[0]}</div>
                      <div className="min-w-0"><p className="text-xs font-medium text-gray-700 truncate">{u.name}</p><p className="text-xs text-gray-400">{ROLE_LABEL[u.role]}</p></div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={()=>{setShowForm(false);setLineName('');setMidApprovers([]);setFinalApprover(null)}}
                className="flex-1 py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm">취소</button>
              <button onClick={handleSave} disabled={saving||!lineName.trim()||!finalApprover}
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}

        {/* 저장된 결재선 목록 */}
        {tabLines.length > 0 && (
          <div className="space-y-3">
            {tabLines.map(line => (
              <div key={line.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bookmark size={14} className="text-primary-500"/>
                    <span className="font-semibold text-gray-900 text-sm">{line.name}</span>
                  </div>
                  <button onClick={async()=>{if(!confirm(`"${line.name}" 삭제?`))return;await deleteApprovalLine(line.id)}}
                    className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={15}/>
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="bg-primary-50 text-primary-700 px-2 py-1 rounded-full">{user?.name} ({activeTab==='outgoing'?'기안자':'접수자'})</span>
                  {line.approvers.map((a,i) => (
                    <span key={i} className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{a.name}</span>
                  ))}
                  <span className="text-gray-300">→</span>
                  <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium">{line.finalApprover.name} (최종)</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {tabLines.length === 0 && !showForm && (
          <div className="text-center py-10 text-gray-400">
            <Bookmark size={32} className="mx-auto mb-2 opacity-30"/>
            <p className="text-sm">저장된 {activeTab==='outgoing'?'발신용':'수신용'} 결재선이 없습니다</p>
          </div>
        )}
      </div>
    </ApprovalShell>
  )
}
