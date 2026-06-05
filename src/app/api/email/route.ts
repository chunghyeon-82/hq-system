import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html } = await req.json()

    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CLEANUP_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const toList = (Array.isArray(to) ? to : [to]).map((email: string) => ({ email }))

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY ?? '',
      },
      body: JSON.stringify({
        sender: {
          name:  process.env.BREVO_FROM_NAME  ?? '기획운영본부',
          email: process.env.BREVO_FROM_EMAIL ?? 'wonchanghq@gmail.com',
        },
        to: toList,
        subject,
        htmlContent: html,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data.message ?? '발송 실패' }, { status: response.status })
    }

    return NextResponse.json({ ok: true, messageId: data.messageId })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
