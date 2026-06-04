'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function SealRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/settings') }, [router])
  return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">설정 페이지로 이동 중...</div>
}
