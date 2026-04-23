import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  const { email, description, attachment } = await req.json()

  if (!description || typeof description !== 'string' || !description.trim()) {
    return NextResponse.json({ error: 'Description is required' }, { status: 400 })
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error('[report-bug] Missing SMTP_HOST, SMTP_USER or SMTP_PASS')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const userEmail = email && typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? email.trim() : null

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  })

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"Swap THORChain" <${SMTP_USER}>`,
    to: process.env.SMTP_TO_EMAIL,
    subject: 'STO Bug Report',
    ...(userEmail ? { replyTo: userEmail } : {}),
    html: `
      <p><strong>Description:</strong></p>
      <pre style="white-space:pre-wrap">${description.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      ${userEmail ? `<p><strong>From:</strong> ${userEmail}</p>` : ''}
    `
  }

  if (attachment && typeof attachment.content === 'string' && typeof attachment.name === 'string') {
    mailOptions.attachments = [{ filename: attachment.name, content: Buffer.from(attachment.content, 'base64') }]
  }

  try {
    const info = await transporter.sendMail(mailOptions)
    console.log('[report-bug] Sent:', info.messageId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[report-bug] Failed to send:', err.message)
    return NextResponse.json({ error: 'Failed to send report' }, { status: 500 })
  }
}
