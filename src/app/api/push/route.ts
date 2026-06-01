import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Firebase Admin 초기화
function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  }
  return getFirestore()
}

// VAPID 설정
webpush.setVapidDetails(
  'mailto:admin@hq-system.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { title, body, url, targetUids } = await req.json()

    // 인증 확인
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CLEANUP_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getAdminDb()
    let tokens: { uid: string; subscription: webpush.PushSubscription }[] = []

    if (targetUids && targetUids.length > 0) {
      // 특정 유저에게만 발송
      for (const uid of targetUids) {
        const snap = await db.collection('fcmTokens').doc(uid).get()
        if (snap.exists) {
          tokens.push({ uid, subscription: snap.data()!.subscription })
        }
      }
    } else {
      // 전체 발송
      const snap = await db.collection('fcmTokens').get()
      tokens = snap.docs.map(d => ({ uid: d.id, subscription: d.data().subscription }))
    }

    const results = await Promise.allSettled(
      tokens.map(({ uid, subscription }) =>
        webpush.sendNotification(
          subscription,
          JSON.stringify({ title, body, url: url || '/dashboard', icon: '/icons/icon-192.png' })
        ).catch(async (err) => {
          // 구독 만료 시 토큰 삭제
          if (err.statusCode === 410 || err.statusCode === 404) {
            await db.collection('fcmTokens').doc(uid).delete()
          }
          throw err
        })
      )
    )

    const sent   = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({ ok: true, sent, failed, total: tokens.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
