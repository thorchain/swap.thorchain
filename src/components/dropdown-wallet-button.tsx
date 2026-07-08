import * as React from 'react'
import { cva } from 'class-variance-authority'
import { Icon } from '@/components/icons'
import { cn } from '@/lib/utils'

const dropdownWalletButtonVariants = cva(
  'group inline-flex h-10 items-center justify-center gap-2 rounded-full border pr-3 pl-4 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer outline-none transition-colors duration-150 ease-out bg-btn-style-1-bg text-btn-style-1-text border-stroke-btn-low-contrast hover:bg-btn-style-1-bg-pressed hover:text-btn-style-1-text-pressed hover:border-transparent active:bg-btn-style-1-bg-hover active:text-btn-style-1-text active:border-transparent data-[state=open]:bg-btn-style-1-bg-hover data-[state=open]:text-btn-style-1-text data-[state=open]:border-transparent'
)

function DropdownWalletButton({ className, children, ...props }: React.ComponentProps<'button'>) {
  return (
    <button data-slot="button" className={cn(dropdownWalletButtonVariants(), className)} {...props}>
      {children}
      <Icon name="arrow-s-down" className="size-4 transition-transform duration-150 ease-out group-data-[state=open]:rotate-180" />
    </button>
  )
}

export { DropdownWalletButton, dropdownWalletButtonVariants }
