import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'placeholder:text-andy aria-invalid:border-lucian flex field-sizing-content max-h-40 w-full resize-none overflow-y-auto rounded-xl border p-4 text-base font-medium wrap-anywhere outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
