'use client'

import { useRef, useState } from 'react'
import { CheckCircle, Paperclip, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ThemeButton } from '@/components/theme-button'

type ReportBugProps = {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

type AttachmentFile = {
  name: string
  content: string
}

export function ReportBug({ isOpen, onOpenChange }: ReportBugProps) {
  const [email, setEmail] = useState('')
  const [description, setDescription] = useState('')
  const [attachment, setAttachment] = useState<AttachmentFile | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      setAttachment({ name: file.name, content: base64 })
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async () => {
    if (!description.trim()) return
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/report-bug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() || undefined, description, attachment })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to send report')
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(() => {
      setEmail('')
      setDescription('')
      setAttachment(null)
      setSubmitted(false)
      setError(null)
    }, 300)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent showCloseButton={false} className="h-auto max-w-md p-8">
        <div className="mb-6 flex items-center justify-between">
          <DialogTitle>Report a Bug</DialogTitle>
          <button onClick={handleClose} className="text-txt-med-contrast hover:text-txt-high-contrast cursor-pointer transition-colors">
            <X className="size-5" />
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle className="size-12 text-green-500" />
            <p className="text-txt-high-contrast font-medium">Thank you! Your report has been sent.</p>
            <ThemeButton variant="primarySmall" className="w-full rounded-xl py-5 text-lg" onClick={handleClose}>
              Close
            </ThemeButton>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-txt-med-contrast mb-2 text-sm">Email (optional)</div>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-input-modal-bg text-txt-high-contrast w-full rounded-xl px-3 py-2 text-base outline-none"
              />
            </div>

            <div>
              <div className="text-txt-med-contrast mb-2 text-sm">
                Description <span className="text-red-500">*</span>
              </div>
              <Textarea
                placeholder="Describe the bug..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="bg-input-modal-bg text-txt-high-contrast min-h-28"
              />
            </div>

            <div>
              <div className="text-txt-med-contrast mb-2 text-sm">Attachment (optional)</div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
              {attachment ? (
                <div className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                  <Paperclip className="text-txt-med-contrast size-4 shrink-0" />
                  <span className="text-txt-high-contrast min-w-0 flex-1 truncate">{attachment.name}</span>
                  <button onClick={() => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="text-txt-med-contrast hover:text-txt-high-contrast cursor-pointer">
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-txt-med-contrast hover:text-txt-high-contrast flex w-full cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors"
                >
                  <Paperclip className="size-4" />
                  Attach a file
                </button>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <ThemeButton
              variant="primarySmall"
              className="w-full rounded-xl py-5 text-lg"
              onClick={handleSubmit}
              disabled={!description.trim() || isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Report'}
            </ThemeButton>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
