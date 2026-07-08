import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const animatedButtonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-15 px-5 py-[26px] text-xl leading-[1.2] font-medium whitespace-nowrap shrink-0 cursor-pointer outline-none transition-colors duration-150 ease-out disabled:bg-btn-animated-inactive disabled:text-txt-btn-animated-inactive disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      colorType: {
        default: 'bg-btn-animated-default text-txt-btn-animated-default hover:bg-btn-animated-hover hover:text-txt-btn-animated-hover',
        accent: 'bg-green-default text-txt-green-default hover:bg-green-hover hover:text-txt-green-hover'
      },
      loading: {
        true: '',
        false: ''
      }
    },
    compoundVariants: [
      // a loading button is disabled but keeps its resting colors instead of the inactive ones
      { colorType: 'default', loading: true, class: 'disabled:bg-btn-animated-default disabled:text-txt-btn-animated-default' },
      { colorType: 'accent', loading: true, class: 'disabled:bg-green-default disabled:text-txt-green-default' }
    ],
    defaultVariants: {
      colorType: 'default',
      loading: false
    }
  }
)

const AnimatedDots = () => (
  <span className="flex h-3.5 items-end gap-1" aria-hidden="true">
    {[0, 300, 600].map(delay => (
      <span key={delay} className="animate-loading-dot bg-btn-animated-dots size-1 rounded-full" style={{ animationDelay: `${delay}ms` }} />
    ))}
  </span>
)

function AnimatedButton({
  className,
  colorType,
  loading = false,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<'button'> &
  Omit<VariantProps<typeof animatedButtonVariants>, 'loading'> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp data-slot="button" className={cn(animatedButtonVariants({ colorType, loading, className }))} {...props}>
      {asChild ? (
        children
      ) : (
        <>
          {children}
          {loading && <AnimatedDots />}
        </>
      )}
    </Comp>
  )
}

export { AnimatedButton, animatedButtonVariants }
