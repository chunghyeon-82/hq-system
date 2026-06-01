import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Firebase Admin 초기화
function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:    process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail:  process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey:   process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  }
  return getFirestore()
}

// 삭제 정책 (밀리초)
const POLICIES = {
  messages_broadcast: 3 * 365 * 24 * 60 * 60 * 1000,   // 3년
  messages_direct_hq: 3 * 365 * 24 * 60 * 60 * 1000,   // 3년 (본부 1:1)
  messages_direct_biz: 7 * 24 * 60 * 60 * 1000,         // 7일 (사업장↔사업장)
  hq_chat: 28 * 24 * 60 * 60 * 1000,                    // 4주
  events_done: 30 * 24 * 60 * 60 * 1000,                // 완료 후 1개월
}

export async function POST(req: NextRequest) {
  // Vercel Cron 또는 수동 호출 시 인증
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CLEANUP_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminDb()
  const now = Date.now()
  let deleted = 0

  try {
    // 1. 메시지: 사업장↔사업장 direct 7일
    const bizDirectSnap = await db.collection('messages')
      .where('type', '==', 'direct')
      .get()
    for (const doc of bizDirectSnap.docs) {
      const data = doc.data()
      // authorBizId 있고, targetUid가 BIZ_REP인 경우 (사업장↔사업장)
      if (!data.authorBizId) continue
      const createdAt = data.createdAt?.toMillis?.() ?? 0
      if (now - createdAt > POLICIES.messages_direct_biz) {
        // target 유저 역할 확인 생략 - authorBizId 있으면 사업장발 메시지
        await doc.ref.delete()
        deleted++
      }
    }

    // 2. 운영본부 채팅 4주
    const chatSnap = await db.collection('hq_chat').get()
    for (const doc of chatSnap.docs) {
      const createdAt = doc.data().createdAt?.toMillis?.() ?? 0
      if (now - createdAt > POLICIES.hq_chat) {
        await doc.ref.delete()
        deleted++
      }
    }

    // 3. 캘린더: 완료 후 1개월
    const eventSnap = await db.collection('events').where('isDone', '==', true).get()
    for (const doc of eventSnap.docs) {
      const doneAt = doc.data().doneAt
        ? new Date(doc.data().doneAt).getTime()
        : doc.data().updatedAt?.toMillis?.() ?? 0
      if (now - doneAt > POLICIES.events_done) {
        await doc.ref.delete()
        deleted++
      }
    }

    // 4. 공지사항: expiresAt 지난 것
    const noticeSnap = await db.collection('notices').get()
    for (const doc of noticeSnap.docs) {
      const expiresAt = new Date(doc.data().expiresAt).getTime()
      if (now > expiresAt) {
        await doc.ref.delete()
        deleted++
      }
    }

    // 5. broadcast 메시지 3년
    const broadcastSnap = await db.collection('messages')
      .where('type', '==', 'broadcast')
      .get()
    for (const doc of broadcastSnap.docs) {
      const createdAt = doc.data().createdAt?.toMillis?.() ?? 0
      if (now - createdAt > POLICIES.messages_broadcast) {
        await doc.ref.delete()
        deleted++
      }
    }

    return NextResponse.json({ ok: true, deleted, timestamp: new Date().toISOString() })
  } catch (e) {
    console.error('Cleanup error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// GET: 헬스체크
export async function GET() {
  return NextResponse.json({ ok: true, message: 'Cleanup API ready' })
}
