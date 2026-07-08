import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Icon } from '@/components/icons'
import { cn } from '@/lib/utils'

const dropdownCoinButtonVariants = cva(
  'group inline-flex items-center justify-center gap-2.5 rounded-full py-2.5 pr-3.5 font-medium whitespace-nowrap shrink-0 cursor-pointer outline-none transition-colors duration-300 ease-out',
  {
    variants: {
      colorType: {
        coin: 'bg-dropdown-default text-txt-dropdown-default hover:bg-dropdown-hover hover:text-txt-dropdown-hover pl-2.5',
        select: 'bg-green-default text-txt-green-default hover:bg-green-hover hover:text-txt-green-hover pl-5'
      }
    },
    defaultVariants: {
      colorType: 'coin'
    }
  }
)

function DropdownCoinButton({
  className,
  colorType,
  open = false,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof dropdownCoinButtonVariants> & {
    open?: boolean
  }) {
  return (
    <button data-slot="button" className={cn(dropdownCoinButtonVariants({ colorType, className }))} {...props}>
      {children}
      <Icon
        name="arrow-s-down"
        className={cn(
          'size-6 transition-transform duration-300 ease-out',
          open && 'rotate-180',
          colorType === 'select' ? 'group-hover:text-icon-btn-default' : 'text-icon-btn-default'
        )}
      />
    </button>
  )
}

export { DropdownCoinButton, dropdownCoinButtonVariants }
