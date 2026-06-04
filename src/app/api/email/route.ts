import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html, pdfBase64, pdfName } = await req.json()

    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CLEANUP_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const attachments = pdfBase64 ? [{
      filename: pdfName ?? '공문.pdf',
      content:  pdfBase64,
    }] : []

    const result = await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
      to:      Array.isArray(to) ? to : [to],
      subject,
      html,
      attachments,
    })

    return NextResponse.json({ ok: true, id: result.data?.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
