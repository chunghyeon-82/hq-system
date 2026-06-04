'use client'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  const router = useRouter()
  return (
    <div className="max-w-2xl mx-auto p-8 text-gray-800">
      <button onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <ArrowLeft size={16}/> 뒤로가기
      </button>

      <h1 className="text-2xl font-bold mb-6">개인정보처리방침</h1>
      <p className="text-sm text-gray-500 mb-8">시행일: 2026년 5월 29일</p>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">1. 수집하는 개인정보</h2>
        <p className="text-sm leading-relaxed">본 앱은 서비스 제공을 위해 다음의 개인정보를 수집합니다.</p>
        <ul className="list-disc ml-5 mt-2 text-sm space-y-1">
          <li>이름, 이메일 주소 (로그인 및 계정 관리)</li>
          <li>메시지 내용 (업무 전달 및 소통)</li>
          <li>앱 사용 활동 정보</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">2. 수집 목적</h2>
        <ul className="list-disc ml-5 text-sm space-y-1">
          <li>사내 본부-사업장 간 업무 전달 및 소통 서비스 제공</li>
          <li>사용자 인증 및 계정 관리</li>
          <li>보안 및 부정 사용 방지</li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">3. 보유 및 이용 기간</h2>
        <p className="text-sm leading-relaxed">수집된 개인정보는 서비스 이용 기간 동안 보유하며, 계정 삭제 시 즉시 파기합니다.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">4. 제3자 제공</h2>
        <p className="text-sm leading-relaxed">수집된 개인정보는 제3자에게 제공하지 않습니다. 단, Firebase(Google)를 통해 인증 및 데이터 저장 서비스를 이용합니다.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">5. 이용자 권리</h2>
        <p className="text-sm leading-relaxed">이용자는 언제든지 본인의 개인정보 조회, 수정, 삭제를 요청할 수 있습니다.</p>
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">6. 문의</h2>
        <p className="text-sm leading-relaxed">개인정보 관련 문의사항은 앱 관리자에게 연락해 주시기 바랍니다.</p>
      </section>
    </div>
  )
}
