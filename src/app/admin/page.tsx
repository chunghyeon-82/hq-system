'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenUsers, listenBusinesses, updateBusiness, ensureHQBusiness } from '@/lib/db'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { secondaryAuth } from '@/lib/firebase'
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { AppUser, Business, UserRole, UserPermissions } from '@/types'
import { UserPlus, Edit2, Trash2, Building2, Check, X, ShieldCheck, Pencil } from 'lucide-react'
import clsx from 'clsx'

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN:     '관리자',
  HQ_CHIEF:  '본부장',
  HQ_MEMBER: '본부멤버',
  BIZ_REP:   '사업장대표',
  ETC:       '기타',
}
const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN:     'bg-purple-100 text-purple-700',
  HQ_CHIEF:  'bg-primary-100 text-primary-700',
  HQ_MEMBER: 'bg-blue-100 text-blue-700',
  BIZ_REP:   'bg-green-100 text-green-700',
  ETC:       'bg-gray-100 text-gray-600',
}

const HQ_ROLES: UserRole[] = ['ADMIN', 'HQ_CHIEF', 'HQ_MEMBER']

// 역할 표시명 (customRole 우선)
function roleDisplay(u: AppUser) {
  if (u.role === 'ETC' && u.customRole) return u.customRole
  return ROLE_LABELS[u.role] ?? u.role
}

function PermToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={clsx(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
        checked ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
      )}>
      <span className={clsx('w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0',
        checked ? 'bg-primary-600 border-primary-600' : 'border-gray-300')}>
        {checked && <Check size={9} className="text-white"/>}
      </span>
      {label}
    </button>
  )
}

export default function AdminPage() {
  const { user } = useAuth()
  const router   = useRouter()

  const [users,      setUsers]      = useState<AppUser[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [showAdd,    setShowAdd]    = useState(false)
  const [editUser,   setEditUser]   = useState<AppUser | null>(null)
  const [hqBizId,    setHqBizId]    = useState('')

  // 신규 추가 폼
  const [newEmail,      setNewEmail]      = useState('')
  const [newPw,         setNewPw]         = useState('')
  const [newName,       setNewName]       = useState('')
  const [newRole,       setNewRole]       = useState<UserRole>('HQ_MEMBER')
  const [newCustomRole, setNewCustomRole] = useState('')
  const [newBizId,      setNewBizId]      = useState('')
  const [newPerms,      setNewPerms]      = useState<UserPermissions>({})
  const [adding,        setAdding]        = useState(false)
  const [addError,      setAddError]      = useState('')

  // 수정 폼
  const [editName,       setEditName]       = useState('')
  const [editRole,       setEditRole]       = useState<UserRole>('HQ_MEMBER')
  const [editCustomRole, setEditCustomRole] = useState('')
  const [editBizId,      setEditBizId]      = useState('')
  const [editPerms,      setEditPerms]      = useState<UserPermissions>({})
  const [saving,         setSaving]         = useState(false)

  useEffect(() => {
    if (user && user.role !== 'ADMIN') { router.replace('/dashboard'); return }
    const u1 = listenUsers(setUsers)
    const u2 = listenBusinesses(setBusinesses)
    ensureHQBusiness().then(setHqBizId)
    return () => { u1(); u2() }
  }, [user, router])

  const openEdit = (u: AppUser) => {
    setEditUser(u)
    setEditName(u.name)
    setEditRole(u.role)
    setEditCustomRole(u.customRole ?? '')
    setEditBizId(u.bizId ?? '')
    setEditPerms(u.permissions ?? {})
  }

  const handleSaveEdit = async () => {
    if (!editUser || !editName.trim()) return
    if (editRole === 'BIZ_REP' && !editBizId) return
    if (editRole === 'ETC' && !editCustomRole.trim()) return
    setSaving(true)

    // bizId 결정
    let assignedBizId: string | null = null
    if (HQ_ROLES.includes(editRole)) {
      assignedBizId = hqBizId || await ensureHQBusiness()
    } else if (editRole === 'BIZ_REP' || editRole === 'ETC') {
      assignedBizId = editBizId || null
    }

    await updateDoc(doc(db, 'users', editUser.uid), {
      name:       editName,
      role:       editRole,
      customRole: editRole === 'ETC' ? editCustomRole.trim() : null,
      bizId:      assignedBizId,
      permissions: editPerms,
    })

    // 이전 사업장 대표 해제
    if (editUser.role === 'BIZ_REP' && editUser.bizId && editUser.bizId !== editBizId) {
      await updateBusiness(editUser.bizId, { repName: '', repUid: '' })
    }
    // 새 사업장 대표 연동
    if (editRole === 'BIZ_REP' && editBizId) {
      await updateBusiness(editBizId, { repName: editName, repUid: editUser.uid })
    }

    setSaving(false)
    setEditUser(null)
  }

  const handleDelete = async (u: AppUser) => {
    if (!confirm(`'${u.name}' 계정을 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return
    if (u.role === 'BIZ_REP' && u.bizId) {
      await updateBusiness(u.bizId, { repName: '', repUid: '' })
    }
    await deleteDoc(doc(db, 'users', u.uid))
  }

  const handleAddUser = async () => {
    if (!newEmail || !newPw || !newName) { setAddError('모두 입력해주세요'); return }
    if (newRole === 'BIZ_REP' && !newBizId) { setAddError('담당 사업장을 선택해주세요'); return }
    if (newRole === 'ETC' && !newCustomRole.trim()) { setAddError('직책명을 입력해주세요'); return }
    setAdding(true); setAddError('')
    try {
      let assignedBizId: string | null = null
      if (HQ_ROLES.includes(newRole)) {
        assignedBizId = hqBizId || await ensureHQBusiness()
      } else if (newRole === 'BIZ_REP' || newRole === 'ETC') {
        assignedBizId = newBizId || null
      }

      // Secondary App으로 생성 — 현재 관리자 로그인 세션 유지
      const cred = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPw)
      // 생성 후 Secondary App 로그아웃 (세션 정리)
      await secondaryAuth.signOut()
      const newUser: AppUser = {
        uid: cred.user.uid, email: newEmail, name: newName,
        role: newRole, permissions: newPerms,
        ...(newRole === 'ETC' ? { customRole: newCustomRole.trim() } : {}),
        ...(assignedBizId ? { bizId: assignedBizId } : {}),
      }
      await setDoc(doc(db, 'users', cred.user.uid), newUser)

      if (newRole === 'BIZ_REP' && newBizId) {
        await updateBusiness(newBizId, { repName: newName, repUid: cred.user.uid })
      }

      setShowAdd(false)
      setNewEmail(''); setNewPw(''); setNewName('')
      setNewBizId(''); setNewRole('HQ_MEMBER'); setNewPerms({})
      setNewCustomRole('')
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : '오류가 발생했습니다')
    } finally { setAdding(false) }
  }

  const showPerms = (role: UserRole) => role !== 'ADMIN' && role !== 'HQ_CHIEF'
  const hqBiz     = businesses.find(b => b.isHQ)
  const adminUsers = users.filter(u => u.role === 'ADMIN')
  const hqMembers  = users.filter(u => u.role === 'HQ_CHIEF' || u.role === 'HQ_MEMBER')
  const bizMembers = users.filter(u => u.role === 'BIZ_REP')
  const etcMembers = users.filter(u => u.role === 'ETC')

  const cardProps = { user, businesses, editUser, editName, editRole, editCustomRole, editBizId, editPerms,
    setEditName, setEditRole, setEditCustomRole, setEditBizId, setEditPerms,
    saving, showPerms, openEdit, handleSaveEdit, handleDelete, setEditUser, hqBizId }

  return (
    <AppShell title="멤버 관리">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">전체 {users.length}명</p>
          <div className="flex gap-2">
            <button onClick={() => router.push('/admin/seals')}
              className="flex items-center gap-2 border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              🔏 직인 관리
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors">
              <UserPlus size={15}/> 계정 추가
            </button>
          </div>
        </div>

        {/* 관리자 */}
        {adminUsers.length > 0 && (
          <Section dot="bg-purple-500" label={`관리자 — ${adminUsers.length}명`} sub="(다른 멤버에게 비노출)">
            {adminUsers.map(u => <MemberCard key={u.uid} u={u} {...cardProps}/>)}
          </Section>
        )}

        {/* 운영본부 */}
        <Section dot="bg-primary-500" label={`운영본부 ${hqBiz ? `(${hqBiz.name})` : ''} — ${hqMembers.length}명`}>
          {hqMembers.length === 0
            ? <Empty>운영본부 멤버가 없습니다</Empty>
            : hqMembers.map(u => <MemberCard key={u.uid} u={u} {...cardProps}/>)}
        </Section>

        {/* 사업장 대표 */}
        <Section dot="bg-green-500" label={`사업장 대표 — ${bizMembers.length}명`}>
          {bizMembers.length === 0
            ? <Empty>등록된 사업장 대표가 없습니다</Empty>
            : bizMembers.map(u => <MemberCard key={u.uid} u={u} {...cardProps}/>)}
        </Section>

        {/* 기타 */}
        {etcMembers.length > 0 && (
          <Section dot="bg-gray-400" label={`기타 — ${etcMembers.length}명`}>
            {etcMembers.map(u => <MemberCard key={u.uid} u={u} {...cardProps}/>)}
          </Section>
        )}
      </div>

      {/* 계정 추가 모달 */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-gray-900">새 계정 추가</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* 기본 정보 */}
              {[
                { label: '이름',     value: newName,  onChange: setNewName,  type: 'text',     placeholder: '홍길동' },
                { label: '이메일',   value: newEmail, onChange: setNewEmail, type: 'email',    placeholder: 'example@email.com' },
                { label: '비밀번호', value: newPw,    onChange: setNewPw,   type: 'password', placeholder: '6자리 이상' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type} value={f.value} onChange={e => f.onChange(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                </div>
              ))}

              {/* 역할 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
                <select value={newRole} onChange={e => { setNewRole(e.target.value as UserRole); setNewPerms({}); setNewCustomRole(''); setNewBizId('') }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][]).filter(([v]) => v !== 'ADMIN').map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              {/* 기타: 직책명 직접 입력 */}
              {newRole === 'ETC' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    직책명 <span className="text-gray-400 font-normal text-xs">— 다른 멤버에게 보입니다</span>
                  </label>
                  <div className="relative">
                    <Pencil size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input value={newCustomRole} onChange={e => setNewCustomRole(e.target.value)}
                      placeholder="예: 회계담당, 물류팀장, 외부감사..."
                      className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                  </div>
                </div>
              )}

              {/* 운영본부 자동 소속 안내 */}
              {HQ_ROLES.includes(newRole) && (
                <div className="bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 text-xs text-primary-700 flex items-center gap-2">
                  <Building2 size={13}/> 저장 시 <strong>운영본부</strong>에 자동 소속됩니다
                </div>
              )}

              {/* 소속 사업장 선택 (사업장대표 또는 기타) */}
              {(newRole === 'BIZ_REP' || newRole === 'ETC') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    소속 {newRole === 'BIZ_REP' ? '사업장 *' : '(선택)'}
                  </label>
                  <select value={newBizId} onChange={e => setNewBizId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                    <option value="">{newRole === 'ETC' ? '소속 없음' : '선택하세요'}</option>
                    {/* ETC는 운영본부도 선택 가능 */}
                    {newRole === 'ETC' && businesses.find(b => b.isHQ) && (
                      <option value={businesses.find(b => b.isHQ)!.id}>운영본부</option>
                    )}
                    {businesses.filter(b => !b.isHQ).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 권한 설정 */}
              {showPerms(newRole) && (
                <div className="space-y-2 pt-1 border-t border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-gray-400"/>
                    <p className="text-sm font-medium text-gray-700">추가 권한</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PermToggle label="사업장 정보 수정" checked={!!newPerms.canEditBusiness}
                      onChange={v => setNewPerms(p => ({ ...p, canEditBusiness: v }))}/>
                    <PermToggle label="전체 메시지 발송" checked={!!newPerms.canBroadcast}
                      onChange={v => setNewPerms(p => ({ ...p, canBroadcast: v }))}/>
                  </div>
                </div>
              )}

              {addError && <p className="text-red-500 text-sm">{addError}</p>}
            </div>
            <div className="flex gap-2 p-5 pt-0">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50">취소</button>
              <button onClick={handleAddUser} disabled={adding}
                className="flex-1 bg-primary-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-primary-800 disabled:opacity-50">
                {adding ? '추가 중...' : '계정 추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}

// ── 섹션 래퍼 ─────────────────────────────────────────
function Section({ dot, label, sub, children }: {
  dot: string; label: string; sub?: string; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className={clsx('w-2 h-2 rounded-full shrink-0', dot)}/>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center py-4 text-gray-400 text-xs bg-gray-50 border border-gray-100 rounded-xl">{children}</div>
  )
}

// ── 멤버 카드 ─────────────────────────────────────────
function MemberCard({ u, user, businesses, editUser, editName, editRole, editCustomRole, editBizId, editPerms,
  setEditName, setEditRole, setEditCustomRole, setEditBizId, setEditPerms,
  saving, showPerms, openEdit, handleSaveEdit, handleDelete, setEditUser, hqBizId }: {
  u: AppUser; user: AppUser | null; businesses: Business[]
  editUser: AppUser | null; editName: string; editRole: UserRole
  editCustomRole: string; editBizId: string; editPerms: UserPermissions
  setEditName: (v: string) => void; setEditRole: (v: UserRole) => void
  setEditCustomRole: (v: string) => void; setEditBizId: (v: string) => void
  setEditPerms: (fn: (p: UserPermissions) => UserPermissions) => void
  saving: boolean; showPerms: (r: UserRole) => boolean
  openEdit: (u: AppUser) => void; handleSaveEdit: () => void
  handleDelete: (u: AppUser) => void; setEditUser: (u: AppUser | null) => void
  hqBizId: string
}) {
  const HQ_ROLES: UserRole[] = ['ADMIN', 'HQ_CHIEF', 'HQ_MEMBER']
  const ROLE_LABELS: Record<UserRole, string> = {
    ADMIN: '관리자', HQ_CHIEF: '본부장', HQ_MEMBER: '본부멤버', BIZ_REP: '사업장대표', ETC: '기타'
  }
  const ROLE_COLORS: Record<UserRole, string> = {
    ADMIN: 'bg-purple-100 text-purple-700', HQ_CHIEF: 'bg-primary-100 text-primary-700',
    HQ_MEMBER: 'bg-blue-100 text-blue-700', BIZ_REP: 'bg-green-100 text-green-700',
    ETC: 'bg-gray-100 text-gray-600',
  }

  const displayRole = u.role === 'ETC' && u.customRole ? u.customRole : ROLE_LABELS[u.role]
  const bizName = businesses.find(b => b.id === u.bizId)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 shrink-0">
          {u.name?.[0] ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{u.name}</span>
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[u.role])}>
              {displayRole}
            </span>
            {/* 소속 (운영본부 소속은 표시 안 함) */}
            {u.bizId && !HQ_ROLES.includes(u.role) && bizName && !bizName.isHQ && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Building2 size={10}/>{bizName.name}
              </span>
            )}
            {u.bizId && u.role === 'ETC' && bizName?.isHQ && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Building2 size={10}/>운영본부
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>
          {u.permissions && (u.permissions.canEditBusiness || u.permissions.canBroadcast) && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {u.permissions.canEditBusiness && (
                <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full">
                  <ShieldCheck size={10}/> 사업장 수정
                </span>
              )}
              {u.permissions.canBroadcast && (
                <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">
                  <ShieldCheck size={10}/> 전체 발송
                </span>
              )}
            </div>
          )}
        </div>
        {u.uid !== user?.uid ? (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => openEdit(u)} className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors">
              <Edit2 size={15}/>
            </button>
            <button onClick={() => handleDelete(u)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
              <Trash2 size={15}/>
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-400 shrink-0">내 계정</span>
        )}
      </div>

      {/* 인라인 수정 폼 */}
      {editUser?.uid === u.uid && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">정보 수정</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">이름</label>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">역할</label>
              <select value={editRole} onChange={e => { setEditRole(e.target.value as UserRole); setEditPerms(() => ({})); setEditCustomRole(''); setEditBizId('') }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                {(Object.entries(ROLE_LABELS) as [UserRole, string][]).filter(([v]) => v !== 'ADMIN').map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* 기타: 직책명 입력 */}
            {editRole === 'ETC' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  직책명 <span className="text-gray-400 font-normal">— 다른 멤버에게 보입니다</span>
                </label>
                <div className="relative">
                  <Pencil size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input value={editCustomRole} onChange={e => setEditCustomRole(e.target.value)}
                    placeholder="예: 회계담당, 물류팀장..."
                    className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
                </div>
              </div>
            )}

            {/* 운영본부 자동 안내 */}
            {HQ_ROLES.includes(editRole) && (
              <div className="sm:col-span-2">
                <div className="bg-primary-50 border border-primary-200 rounded-lg px-3 py-2 text-xs text-primary-700 flex items-center gap-2">
                  <Building2 size={12}/> 운영본부에 자동 소속됩니다
                </div>
              </div>
            )}

            {/* 소속 선택 (사업장대표 또는 기타) */}
            {(editRole === 'BIZ_REP' || editRole === 'ETC') && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  소속 {editRole === 'BIZ_REP' ? '사업장 *' : '(선택)'}
                </label>
                <select value={editBizId} onChange={e => setEditBizId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                  <option value="">{editRole === 'ETC' ? '소속 없음' : '선택하세요'}</option>
                  {editRole === 'ETC' && businesses.find(b => b.isHQ) && (
                    <option value={businesses.find(b => b.isHQ)!.id}>운영본부</option>
                  )}
                  {businesses.filter(b => !b.isHQ).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 권한 */}
          {showPerms(editRole) && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-gray-400"/>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">추가 권한</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PermToggle label="사업장 정보 수정" checked={!!editPerms.canEditBusiness}
                  onChange={v => setEditPerms(p => ({ ...p, canEditBusiness: v }))}/>
                <PermToggle label="전체 메시지 발송" checked={!!editPerms.canBroadcast}
                  onChange={v => setEditPerms(p => ({ ...p, canBroadcast: v }))}/>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleSaveEdit}
              disabled={saving || !editName.trim() || (editRole === 'BIZ_REP' && !editBizId) || (editRole === 'ETC' && !editCustomRole.trim())}
              className="flex items-center gap-1.5 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors">
              <Check size={14}/> {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => setEditUser(null)}
              className="flex items-center gap-1.5 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors">
              <X size={14}/> 취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
