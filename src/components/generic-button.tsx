import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const genericButtonVariants = cva(
  'inline-flex items-center justify-center gap-1 rounded-full font-medium whitespace-nowrap shrink-0 cursor-pointer outline-none transition-colors duration-300 ease-in-out hover:bg-btn-small-hover hover:text-txt-btn-small-hover disabled:bg-btn-small-inactive disabled:text-txt-btn-small-inactive disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      colorType: {
        '1': 'bg-btn-small-default text-txt-btn-small-default active:bg-btn-small-focus active:text-txt-btn-small-focus',
        '2': 'bg-btn-small-darker text-txt-btn-small-default active:bg-btn-small-focus active:text-txt-btn-small-focus',
        '3': 'bg-green-default text-txt-green-default active:bg-green-default active:text-txt-green-default'
      },
      size: {
        small: 'text-xs leading-none',
        medium: 'text-base leading-none',
        large: 'text-xl leading-[1.2]'
      },
      iconMode: {
        none: '',
        left: '',
        only: ''
      }
    },
    compoundVariants: [
      { size: 'small', iconMode: 'none', class: 'p-3' },
      { size: 'small', iconMode: 'left', class: "pl-3 pr-4 py-[11px] [&_svg:not([class*='size-'])]:size-3.5" },
      { size: 'small', iconMode: 'only', class: "size-9 [&_svg:not([class*='size-'])]:size-5" },
      { size: 'medium', iconMode: 'none', class: 'p-3' },
      { size: 'medium', iconMode: 'left', class: "pl-3 pr-4 py-2.5 [&_svg:not([class*='size-'])]:size-5" },
      { size: 'medium', iconMode: 'only', class: "size-10 p-2.5 [&_svg:not([class*='size-'])]:size-6" },
      { size: 'large', iconMode: 'none', class: 'p-5' },
      { size: 'large', iconMode: 'left', class: "pl-5 pr-6 py-[18px] [&_svg:not([class*='size-'])]:size-7" },
      { size: 'large', iconMode: 'only', class: "p-3 [&_svg:not([class*='size-'])]:size-9" }
    ],
    defaultVariants: {
      colorType: '1',
      size: 'large',
      iconMode: 'none'
    }
  }
)

function GenericButton({
  className,
  colorType,
  size,
  icon,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<'button'> &
  Omit<VariantProps<typeof genericButtonVariants>, 'iconMode'> & {
    asChild?: boolean
    icon?: React.ReactNode
  }) {
  const Comp = asChild ? Slot : 'button'
  const iconMode = icon ? (children ? 'left' : 'only') : 'none'

  return (
    <Comp data-slot="button" className={cn(genericButtonVariants({ colorType, size, iconMode, className }))} {...props}>
      {asChild ? (
        children
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </Comp>
  )
}

export { GenericButton, genericButtonVariants }
