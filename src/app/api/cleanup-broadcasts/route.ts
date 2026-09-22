import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

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

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CLEANUP_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const db      = getAdminDb()
    const today   = new Date().toISOString().split('T')[0]
    const snap    = await db.collection('messages')
      .where('type', '==', 'broadcast')
      .where('neverDelete', '!=', true)
      .get()

    const toDelete = snap.docs.filter(doc => {
      const expiresAt = doc.data().expiresAt
      return expiresAt && expiresAt <= today
    })

    await Promise.all(toDelete.map(doc => doc.ref.delete()))
    return NextResponse.json({ deleted: toDelete.length, date: today })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// Vercel cron trigger
export async function POST(req: NextRequest) {
  return GET(req)
}
