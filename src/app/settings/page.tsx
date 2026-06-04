'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { uploadImage } from '@/lib/upload'
import { updateUserSeal } from '@/lib/db'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/lib/auth-context'
import { useSettings, FontSize } from '@/lib/settings-context'
import { subscribePush, unsubscribePush, getPushPermission } from '@/lib/push'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { upsertUser } from '@/lib/db'
import { auth } from '@/lib/firebase'
import {
  Bell, BellOff, Type, User, Info, ChevronRight,
  Lock, CheckCircle2, AlertCircle, Eye, EyeOff
} from 'lucide-react'

export default function SettingsPage() {
  const { user, loading }                   = useAuth()
  const { settings, updateSettings } = useSettings()
  const router                     = useRouter()

  const [section, setSection]     = useState<null | 'account' | 'password' | 'appinfo'>(null)
  const [pushPerm, setPushPerm]   = useState<NotificationPermission>('default')
  const [pushLoading, setPushLoading] = useState(false)

  // 계정 설정
  const [name,    setName]    = useState(user?.name ?? '')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  // 비밀번호 변경
  const [curPw,   setCurPw]   = useState('')
  const [newPw,   setNewPw]   = useState('')
  const [newPw2,  setNewPw2]  = useState('')
  const [showPw,  setShowPw]  = useState(false)
  const [pwMsg,   setPwMsg]   = useState('')
  const [pwError,      setPwError]      = useState(false)
  const [sealPreview,  setSealPreview]  = useState<string>('')
  const [sealSaving,   setSealSaving]   = useState(false)
  const sealFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    setName(user.name)
    getPushPermission().then(setPushPerm)
  }, [user, router])

  // ── 무음 모드 토글 ─────────────────────────────────
  const toggleSilent = () => updateSettings({ silentMode: !settings.silentMode })

  // ── 글자 크기 ──────────────────────────────────────
  const fontSizes: { value: FontSize; label: string }[] = [
    { value: 'small',  label: '작게' },
    { value: 'medium', label: '보통' },
    { value: 'large',  label: '크게' },
  ]

  // ── 푸시 알림 ──────────────────────────────────────
  const togglePush = async () => {
    if (!user) return
    setPushLoading(true)
    if (settings.pushEnabled) {
      await unsubscribePush(user.uid)
      await updateSettings({ pushEnabled: false })
    } else {
      const perm = await Notification.requestPermission()
      setPushPerm(perm)
      if (perm === 'granted') {
        const result = await subscribePush(user.uid)
        if (result.ok) await updateSettings({ pushEnabled: true })
      }
    }
    setPushLoading(false)
  }

  // ── 이름 저장 ──────────────────────────────────────
  const handleSealUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return
    const file = e.target.files?.[0]
    if (!file) return
    setSealSaving(true)
    try {
      const url = await uploadImage(file, `userSeals/${user.uid}.png`)
      await updateUserSeal(user.uid, url)
      setSealPreview(url)
    } catch (err) {
      console.error(err); alert('업로드 중 오류가 발생했습니다')
    } finally { setSealSaving(false) }
  }

  const saveName = async () => {
    if (!user || !name.trim()) return
    setSaving(true)
    await upsertUser({ ...user, name: name.trim() })
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── 비밀번호 변경 ──────────────────────────────────
  const changePassword = async () => {
    setPwMsg(''); setPwError(false)
    if (newPw !== newPw2)         { setPwMsg('새 비밀번호가 일치하지 않습니다'); setPwError(true); return }
    if (newPw.length < 6)         { setPwMsg('비밀번호는 6자 이상이어야 합니다'); setPwError(true); return }
    if (!auth.currentUser?.email) return
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email, curPw)
      await reauthenticateWithCredential(auth.currentUser, cred)
      await updatePassword(auth.currentUser, newPw)
      setPwMsg('비밀번호가 변경되었습니다')
      setCurPw(''); setNewPw(''); setNewPw2('')
    } catch (e: unknown) {
      const msg = (e as { code?: string })?.code === 'auth/wrong-password'
        ? '현재 비밀번호가 올바르지 않습니다'
        : '변경 중 오류가 발생했습니다'
      setPwMsg(msg); setPwError(true)
    }
  }

  const SectionHeader = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2 mb-3">
      <button onClick={() => setSection(null)} className="text-gray-400 hover:text-gray-600 text-sm">← 설정</button>
      <span className="text-gray-300">/</span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </div>
  )

  // ── 계정 설정 섹션 ─────────────────────────────────
  if (section === 'account') return (
    <AppShell title="계정 설정">
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <SectionHeader label="계정 설정"/>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">이름</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"/>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">이메일</label>
            <input value={user?.email ?? ''} disabled
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 text-gray-400"/>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">역할</label>
            <input value={user?.role === 'ETC' && user?.customRole ? user.customRole : (
              ({ ADMIN:'관리자', HQ_CHIEF:'본부장', HQ_MEMBER:'본부멤버', BIZ_REP:'사업장대표', ETC:'기타' } as Record<string, string>)[user?.role ?? ''] ?? ''
            )} disabled
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 text-gray-400"/>
          </div>
          <button onClick={saveName} disabled={saving || !name.trim()}
            className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-800 disabled:opacity-50 flex items-center justify-center gap-2">
            {saved ? <><CheckCircle2 size={16}/> 저장됨</> : saving ? '저장 중...' : '저장'}
          </button>
        </div>
        <button onClick={() => setSection('password')}
          className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-2xl p-5 hover:bg-gray-50">
          <div className="flex items-center gap-3">
            <Lock size={18} className="text-gray-500"/>
            <span className="text-sm font-medium text-gray-800">비밀번호 변경</span>
          </div>
          <ChevronRight size={16} className="text-gray-400"/>
        </button>
      </div>
    </AppShell>
  )

  // ── 비밀번호 변경 섹션 ────────────────────────────
  if (section === 'password') return (
    <AppShell title="비밀번호 변경">
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <SectionHeader label="비밀번호 변경"/>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          {[
            { label: '현재 비밀번호', value: curPw, setter: setCurPw },
            { label: '새 비밀번호',   value: newPw, setter: setNewPw },
            { label: '새 비밀번호 확인', value: newPw2, setter: setNewPw2 },
          ].map(({ label, value, setter }) => (
            <div key={label}>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">{label}</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={value}
                  onChange={e => setter(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 pr-10"/>
                <button onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>
          ))}
          {pwMsg && (
            <div className={`flex items-center gap-2 text-sm ${pwError ? 'text-red-600' : 'text-green-600'}`}>
              {pwError ? <AlertCircle size={14}/> : <CheckCircle2 size={14}/>}
              {pwMsg}
            </div>
          )}
          <button onClick={changePassword}
            disabled={!curPw || !newPw || !newPw2}
            className="w-full py-3 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-800 disabled:opacity-50">
            변경하기
          </button>
        </div>
      </div>
    </AppShell>
  )

  // ── 앱 정보 섹션 ──────────────────────────────────
  if (section === 'appinfo') return (
    <AppShell title="앱 정보">
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <SectionHeader label="앱 정보"/>
        <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
          {[
            { label: '앱 이름',   value: '본부관리시스템' },
            { label: '버전',      value: 'v1.0.0' },
            { label: '개발',      value: '조충현' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center px-5 py-4">
              <span className="text-sm text-gray-600">{label}</span>
              <span className="text-sm font-medium text-gray-900">{value}</span>
            </div>
          ))}
          <button onClick={() => router.push('/privacy')}
            className="w-full flex justify-between items-center px-5 py-4 hover:bg-gray-50">
            <span className="text-sm text-gray-600">개인정보처리방침</span>
            <ChevronRight size={16} className="text-gray-400"/>
          </button>
          <div className="px-5 py-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              데이터 보관 정책: 전달 3년, 운영본부 채팅 4주,
              1:1 메시지(업무) 3년, 사업장간 1:1 7일,
              캘린더 완료 후 1개월, 공지사항 게시 종료일까지
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  )

  // ── 메인 설정 화면 ─────────────────────────────────
  return (
    <AppShell title="설정">
      <div className="max-w-3xl mx-auto p-4 space-y-4">

        {/* 알림 */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">알림</p>
          </div>
          {/* 푸시 알림 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Bell size={18} className="text-gray-500"/>
              <div>
                <p className="text-sm font-medium text-gray-800">푸시 알림</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {pushPerm === 'denied' ? '브라우저에서 차단됨 — 브라우저 설정에서 허용해주세요' :
                   settings.pushEnabled ? '알림이 활성화되어 있습니다' : '알림이 꺼져 있습니다'}
                </p>
              </div>
            </div>
            <button onClick={togglePush} disabled={pushLoading || pushPerm === 'denied'}
              style={{
                position:'relative', width:'48px', height:'26px',
                borderRadius:'99px', border:'none', cursor:'pointer',
                backgroundColor: settings.pushEnabled ? '#534AB7' : '#D1D5DB',
                transition:'background-color .2s',
                opacity: (pushLoading || pushPerm === 'denied') ? 0.4 : 1,
                flexShrink: 0,
              }}>
              <span style={{
                position:'absolute',
                top:'3px',
                left: settings.pushEnabled ? '25px' : '3px',
                width:'20px', height:'20px',
                backgroundColor:'white',
                borderRadius:'50%',
                boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
                transition:'left .2s',
                display:'block',
              }}/>
            </button>
          </div>
          {/* 무음 모드 */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <BellOff size={18} className="text-gray-500"/>
              <div>
                <p className="text-sm font-medium text-gray-800">무음 모드</p>
                <p className="text-xs text-gray-400 mt-0.5">알림 소리·진동 끄기</p>
              </div>
            </div>
            <button onClick={toggleSilent}
              style={{
                position:'relative', width:'48px', height:'26px',
                borderRadius:'99px', border:'none', cursor:'pointer',
                backgroundColor: settings.silentMode ? '#534AB7' : '#D1D5DB',
                transition:'background-color .2s',
                flexShrink: 0,
              }}>
              <span style={{
                position:'absolute',
                top:'3px',
                left: settings.silentMode ? '25px' : '3px',
                width:'20px', height:'20px',
                backgroundColor:'white',
                borderRadius:'50%',
                boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
                transition:'left .2s',
                display:'block',
              }}/>
            </button>
          </div>
        </div>

        {/* 화면 */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">화면</p>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center gap-3 mb-3">
              <Type size={18} className="text-gray-500"/>
              <p className="text-sm font-medium text-gray-800">글자 크기</p>
            </div>
            <div className="flex gap-2">
              {fontSizes.map(({ value, label }) => (
                <button key={value}
                  onClick={() => updateSettings({ fontSize: value })}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    settings.fontSize === value
                      ? 'bg-primary-50 border-primary-400 text-primary-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              미리보기: <span style={{ fontSize: settings.fontSize === 'small' ? '13px' : settings.fontSize === 'large' ? '17px' : '15px' }}>
                가나다라 ABC 123
              </span>
            </p>
          </div>
        </div>

        {/* 계정 */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">계정</p>
          </div>
          {[
            { icon: User, label: '내 정보 / 비밀번호 변경', action: () => setSection('account') },
          ].map(({ icon: Icon, label, action }) => (
            <button key={label} onClick={action}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <Icon size={18} className="text-gray-500"/>
                <span className="text-sm font-medium text-gray-800">{label}</span>
              </div>
              <ChevronRight size={16} className="text-gray-400"/>
            </button>
          ))}
        </div>

        {/* 앱 정보 */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <button onClick={() => setSection('appinfo')}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <Info size={18} className="text-gray-500"/>
              <span className="text-sm font-medium text-gray-800">앱 정보</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">v1.0.0</span>
              <ChevronRight size={16} className="text-gray-400"/>
            </div>
          </button>
        </div>
      </div>
    </AppShell>
  )
}
