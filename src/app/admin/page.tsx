'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { listenUsers, listenBusinesses, updateBusiness } from '@/lib/db'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import type { AppUser, Business, UserRole, UserPermissions } from '@/types'
import { UserPlus, Edit2, Trash2, Building2, Check, X, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: '관리자', HQ_CHIEF: '본부장', HQ_MEMBER: '본부멤버', BIZ_REP: '사업장대표'
}
const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN:     'bg-purple-100 text-purple-700',
  HQ_CHIEF:  'bg-primary-100 text-primary-700',
  HQ_MEMBER: 'bg-blue-100 text-blue-700',
  BIZ_REP:   'bg-green-100 text-green-700',
}

function PermToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={clsx(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
        checked
          ? 'bg-primary-50 border-primary-300 text-primary-700'
          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
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

  // 신규 추가 폼
  const [newEmail,  setNewEmail]  = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [newName,   setNewName]   = useState('')
  const [newRole,   setNewRole]   = useState<UserRole>('HQ_MEMBER')
  const [newBizId,  setNewBizId]  = useState('')
  const [newPerms,  setNewPerms]  = useState<UserPermissions>({})
  const [adding,    setAdding]    = useState(false)
  const [addError,  setAddError]  = useState('')

  // 수정 폼
  const [editName,  setEditName]  = useState('')
  const [editRole,  setEditRole]  = useState<UserRole>('HQ_MEMBER')
  const [editBizId, setEditBizId] = useState('')
  const [editPerms, setEditPerms] = useState<UserPermissions>({})
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (user && user.role !== 'ADMIN') { router.replace('/dashboard'); return }
    const u1 = listenUsers(setUsers)
    const u2 = listenBusinesses(setBusinesses)
    return () => { u1(); u2() }
  }, [user, router])

  const openEdit = (u: AppUser) => {
    setEditUser(u)
    setEditName(u.name)
    setEditRole(u.role)
    setEditBizId(u.bizId ?? '')
    setEditPerms(u.permissions ?? {})
  }

  const handleSaveEdit = async () => {
    if (!editUser || !editName.trim()) return
    if (editRole === 'BIZ_REP' && !editBizId) return
    setSaving(true)

    const userData: Record<string, unknown> = {
      name: editName, role: editRole,
      bizId: editRole === 'BIZ_REP' && editBizId ? editBizId : null,
      permissions: editPerms,
    }
    await updateDoc(doc(db, 'users', editUser.uid), userData)

    // 이전 사업장 대표자 해제
    if (editUser.bizId && editUser.bizId !== editBizId) {
      await updateBusiness(editUser.bizId, { repName: '', repUid: '' })
    }
    // 새 사업장 대표자 연동
    if (editRole === 'BIZ_REP' && editBizId) {
      await updateBusiness(editBizId, { repName: editName, repUid: editUser.uid })
    }

    setSaving(false)
    setEditUser(null)
  }

  const handleDelete = async (u: AppUser) => {
    if (!confirm(`'${u.name}' 계정을 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return
    if (u.bizId) await updateBusiness(u.bizId, { repName: '', repUid: '' })
    await deleteDoc(doc(db, 'users', u.uid))
  }

  const handleAddUser = async () => {
    if (!newEmail || !newPw || !newName) { setAddError('모두 입력해주세요'); return }
    if (newRole === 'BIZ_REP' && !newBizId) { setAddError('담당 사업장을 선택해주세요'); return }
    setAdding(true); setAddError('')
    try {
      const cred = await createUserWithEmailAndPassword(auth, newEmail, newPw)
      const newUser: AppUser = {
        uid: cred.user.uid, email: newEmail, name: newName, role: newRole,
        permissions: newPerms,
        ...(newRole === 'BIZ_REP' && newBizId ? { bizId: newBizId } : {}),
      }
      await setDoc(doc(db, 'users', cred.user.uid), newUser)
      if (newRole === 'BIZ_REP' && newBizId) {
        await updateBusiness(newBizId, { repName: newName, repUid: cred.user.uid })
      }
      setShowAdd(false)
      setNewEmail(''); setNewPw(''); setNewName(''); setNewBizId('')
      setNewRole('HQ_MEMBER'); setNewPerms({})
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : '오류가 발생했습니다')
    } finally { setAdding(false) }
  }

  // 역할별 권한 설명
  const permDesc = (role: UserRole) => {
    if (role === 'ADMIN' || role === 'HQ_CHIEF') return '모든 권한 기본 부여'
    if (role === 'BIZ_REP') return '1:1 메시지 발송만 가능 (추가 권한 선택)'
    return '추가 권한 선택 가능'
  }

  const showPerms = (role: UserRole) => role !== 'ADMIN' && role !== 'HQ_CHIEF'

  return (
    <AppShell title="멤버 관리">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">전체 {users.length}명</p>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors">
            <UserPlus size={15}/> 계정 추가
          </button>
        </div>

        <div className="space-y-2">
          {users.map(u => (
            <div key={u.uid} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 shrink-0">
                  {u.name?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900">{u.name}</span>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[u.role])}>
                      {ROLE_LABELS[u.role]}
                    </span>
                    {u.bizId && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Building2 size={10}/>
                        {businesses.find(b => b.id === u.bizId)?.name ?? u.bizId}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>
                  {/* 권한 뱃지 */}
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
                    <button onClick={() => openEdit(u)}
                      className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors">
                      <Edit2 size={15}/>
                    </button>
                    <button onClick={() => handleDelete(u)}
                      className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
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
                      <select value={editRole} onChange={e => { setEditRole(e.target.value as UserRole); setEditPerms({}) }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                        {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                    {editRole === 'BIZ_REP' && (
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">담당 사업장</label>
                        <select value={editBizId} onChange={e => setEditBizId(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                          <option value="">선택하세요</option>
                          {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* 권한 설정 */}
                  {showPerms(editRole) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck size={13} className="text-gray-400"/>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">추가 권한</p>
                        <span className="text-xs text-gray-400">— {permDesc(editRole)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <PermToggle
                          label="사업장 정보 수정"
                          checked={!!editPerms.canEditBusiness}
                          onChange={v => setEditPerms(p => ({ ...p, canEditBusiness: v }))}
                        />
                        <PermToggle
                          label="전체 메시지 발송"
                          checked={!!editPerms.canBroadcast}
                          onChange={v => setEditPerms(p => ({ ...p, canBroadcast: v }))}
                        />
                      </div>
                    </div>
                  )}

                  {editRole === 'BIZ_REP' && editBizId && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                      저장하면 <strong>{businesses.find(b => b.id === editBizId)?.name}</strong>의 대표자가 <strong>{editName}</strong>으로 자동 등록됩니다.
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={handleSaveEdit}
                      disabled={saving || !editName.trim() || (editRole === 'BIZ_REP' && !editBizId)}
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
          ))}
        </div>
      </div>

      {/* 계정 추가 모달 */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="font-semibold text-gray-900">새 계정 추가</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
                <select value={newRole} onChange={e => { setNewRole(e.target.value as UserRole); setNewPerms({}) }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                  {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              {newRole === 'BIZ_REP' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">담당 사업장</label>
                  <select value={newBizId} onChange={e => setNewBizId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                    <option value="">선택하세요</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              {/* 권한 설정 */}
              {showPerms(newRole) && (
                <div className="space-y-2 pt-1 border-t border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-gray-400"/>
                    <p className="text-sm font-medium text-gray-700">추가 권한</p>
                    <span className="text-xs text-gray-400">— {permDesc(newRole)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PermToggle
                      label="사업장 정보 수정"
                      checked={!!newPerms.canEditBusiness}
                      onChange={v => setNewPerms(p => ({ ...p, canEditBusiness: v }))}
                    />
                    <PermToggle
                      label="전체 메시지 발송"
                      checked={!!newPerms.canBroadcast}
                      onChange={v => setNewPerms(p => ({ ...p, canBroadcast: v }))}
                    />
                  </div>
                </div>
              )}

              {newRole === 'BIZ_REP' && newBizId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                  저장하면 <strong>{businesses.find(b => b.id === newBizId)?.name}</strong>의 대표자가 <strong>{newName || '(이름 입력 필요)'}</strong>으로 자동 등록됩니다.
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
