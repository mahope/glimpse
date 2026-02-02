import { Resend } from 'resend'

let _resend: Resend | null = null

export function getResend() {
  if (_resend) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is missing')
  _resend = new Resend(key)
  return _resend
}

export type SendEmailOptions = {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  attachments?: { filename: string; content: Buffer; contentType?: string }[]
  from?: string // default from env
}

export async function sendEmail(opts: SendEmailOptions) {
  const resend = getResend()
  const from = opts.from ?? process.env.EMAIL_FROM ?? 'Glimpse <noreply@glimpse.local>'
  const { data, error } = await resend.emails.send({
    from,
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments?.map(a => ({ filename: a.filename, content: a.content, contentType: a.contentType ?? 'application/pdf' }))
  })
  if (error) throw error
  return data
}
