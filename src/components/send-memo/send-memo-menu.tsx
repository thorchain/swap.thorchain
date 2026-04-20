'use client'

import Image from 'next/image'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import Lottie, { LottieRefCurrentProps } from 'lottie-react'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import { Dialog, DialogPortal } from '@/components/ui/dialog'
import { AppConfig } from '@/config'
import { cn } from '@/lib/utils'

import { bondAnim, memoAnim, swapAnim, tcyAnim } from './animations'

const SOCIAL_LINKS = [
  {
    label: 'X (Twitter)',
    icon: (
      <svg width="20" height="19" viewBox="0 0 20 19" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M15.8014 0H18.867L12.136 8.06273L20 19H13.8287L8.997 12.3535L3.46551 19H0.399867L7.53082 10.3764L0 0H6.32456L10.6898 6.07159L15.8014 0ZM14.7284 17.107H16.4279L5.43152 1.82288H3.60546L14.7284 17.107Z"
          fill="#FAFAFA"
        />
      </svg>
    ),
    href: 'https://twitter.com/THORChain'
  },
  {
    label: 'Telegram',
    icon: (
      <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M18.6339 0.0653823L0.520771 6.77709C0.509994 6.78106 0.499547 6.78582 0.48952 6.7913C0.34264 6.87098 -0.682396 7.47134 0.762967 8.00961L0.777811 8.01484L5.09085 9.3491C5.12376 9.35934 5.1586 9.36257 5.19295 9.35856C5.22729 9.35456 5.26031 9.34341 5.28969 9.32591L15.9873 2.93477C16.0135 2.9191 16.0428 2.90855 16.0733 2.90373C16.2221 2.88016 16.6506 2.83602 16.3795 3.16557C16.0729 3.53962 8.76598 9.80957 7.95501 10.5049C7.90825 10.5451 7.87932 10.601 7.87415 10.6609L7.52023 14.7007C7.52019 14.7419 7.53015 14.7825 7.54934 14.8193C7.56853 14.8561 7.59642 14.8881 7.63078 14.9128C7.67955 14.9422 7.73689 14.9559 7.79436 14.9517C7.85182 14.9475 7.90636 14.9258 7.94993 14.8896L10.5125 12.6965C10.553 12.6619 10.6046 12.6416 10.6589 12.6389C10.7131 12.6363 10.7666 12.6515 10.8106 12.682L15.2814 15.7904L15.2959 15.7997C15.4041 15.8637 16.5729 16.5149 16.9104 15.0606L19.9964 1.00913C20.0007 0.964615 20.0425 0.475349 19.6773 0.186203C19.2937 -0.116035 18.7507 0.0365798 18.6691 0.0530383C18.657 0.0562485 18.6453 0.0603764 18.6339 0.0653823Z"
          fill="#FAFAFA"
        />
      </svg>
    ),
    href: AppConfig.telegramLink
  },
  {
    label: 'Discord',
    icon: (
      <svg width="20" height="15" viewBox="0 0 20 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12.8155 0C12.62 0.343329 12.4445 0.698502 12.285 1.06156C10.7693 0.836619 9.22574 0.836619 7.70605 1.06156C7.55055 0.698502 7.37106 0.343329 7.17559 0C5.75169 0.240729 4.36362 0.662984 3.04741 1.25888C0.438864 5.08286 -0.267107 8.80821 0.0838889 12.4822C1.61154 13.5991 3.32263 14.4515 5.14542 14.996C5.55622 14.4515 5.91921 13.8714 6.23033 13.2676C5.63999 13.0505 5.06962 12.7782 4.52319 12.4625C4.66678 12.3599 4.80637 12.2533 4.942 12.1508C8.14484 13.6424 11.8542 13.6424 15.061 12.1508C15.1966 12.2613 15.3362 12.3678 15.4798 12.4625C14.9334 12.7821 14.363 13.0505 13.7687 13.2715C14.0798 13.8753 14.4428 14.4554 14.8536 15C16.6764 14.4554 18.3875 13.6069 19.9152 12.4901C20.33 8.22809 19.2052 4.53434 16.9436 1.26284C15.6314 0.666932 14.2434 0.244672 12.8195 0.00789131L12.8155 0ZM6.67703 10.221C5.69186 10.221 4.87416 9.33702 4.87416 8.24389C4.87416 7.15077 5.65991 6.26282 6.67302 6.26282C7.68613 6.26282 8.49181 7.15468 8.47589 8.24389C8.45992 9.33305 7.68218 10.221 6.67703 10.221ZM13.322 10.221C12.3329 10.221 11.5232 9.33702 11.5232 8.24389C11.5232 7.15077 12.3089 6.26282 13.322 6.26282C14.3351 6.26282 15.1368 7.15468 15.1208 8.24389C15.1049 9.33305 14.3271 10.221 13.322 10.221Z"
          fill="#FAFAFA"
        />
      </svg>
    ),
    href: AppConfig.discordLink
  },
  {
    label: 'GitLab',
    icon: (
      <svg width="20" height="19" viewBox="0 0 20 19" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.15188 7.29541H6.2999L4.01189 0.223141C3.75041 -0.180989 3.5216 0.0547535 3.43989 0.223141L1.15188 7.29541Z" fill="#FAFAFA" />
        <path d="M18.7728 7.29541H13.7908L16.005 0.223141C16.2581 -0.180989 16.4795 0.0547535 16.5586 0.223141L18.7728 7.29541Z" fill="#FAFAFA" />
        <path
          d="M0.0742667 10.6863L1.16246 7.29309L10.047 18.9997C9.91405 18.9874 9.83933 18.9695 9.70606 18.9148C9.57279 18.8601 0.240332 11.7891 0.240332 11.7891C-0.0917987 11.5176 -0.008766 10.9408 0.0742667 10.6863Z"
          fill="#FAFAFA"
        />
        <path
          d="M19.9257 10.6863L18.7633 7.29309L10.0361 18.9997C10.169 18.9874 10.2437 18.9695 10.377 18.9148C10.5102 18.8601 19.7597 11.7891 19.7597 11.7891C20.0918 11.5176 20.0088 10.9408 19.9257 10.6863Z"
          fill="#FAFAFA"
        />
        <path d="M10.0361 18.9997L1.15188 7.29309H6.38294L10.0361 18.9997Z" fill="#FAFAFA" />
        <path d="M10.0544 18.9997L18.7728 7.29309H13.7161L10.0544 18.9997Z" fill="#FAFAFA" />
        <path d="M10.0427 18.9997L6.30627 7.29309H10.0427V18.9997Z" fill="#FAFAFA" />
        <path d="M10.0405 18.9997L13.777 7.29309H10.0405V18.9997Z" fill="#FAFAFA" />
      </svg>
    ),
    href: 'https://gitlab.com/thorchain'
  },
  {
    label: 'Reddit',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M20 10.25C20 4.727 15.523 0.25 10 0.25C4.477 0.25 0 4.727 0 10.25C0 15.773 4.477 20.25 10 20.25C15.523 20.25 20 15.773 20 10.25ZM15.93 9.5C16.27 9.84 16.46 10.29 16.46 10.76C16.46 11.98 15.31 12.97 13.89 13.4C13.34 14.56 11.78 15.4 10 15.4C8.22 15.4 6.66 14.56 6.11 13.4C4.69 12.97 3.54 11.98 3.54 10.76C3.54 10.29 3.73 9.84 4.07 9.5C3.92 9.19 3.84 8.86 3.84 8.51C3.84 7.21 4.9 6.15 6.2 6.15C6.82 6.15 7.4 6.4 7.83 6.83C8.5 6.5 9.23 6.32 10 6.31C10.77 6.32 11.5 6.5 12.17 6.83C12.6 6.4 13.18 6.15 13.8 6.15C15.1 6.15 16.16 7.21 16.16 8.51C16.16 8.86 16.08 9.19 15.93 9.5ZM7.5 10.25C7.5 9.7 7.05 9.25 6.5 9.25C5.95 9.25 5.5 9.7 5.5 10.25C5.5 10.8 5.95 11.25 6.5 11.25C7.05 11.25 7.5 10.8 7.5 10.25ZM12.35 12.75C11.85 13.25 11 13.5 10 13.5C9 13.5 8.15 13.25 7.65 12.75C7.45 12.55 7.13 12.55 6.93 12.75C6.73 12.95 6.73 13.27 6.93 13.47C7.63 14.17 8.76 14.5 10 14.5C11.24 14.5 12.37 14.17 13.07 13.47C13.27 13.27 13.27 12.95 13.07 12.75C12.87 12.55 12.55 12.55 12.35 12.75ZM13.5 11.25C14.05 11.25 14.5 10.8 14.5 10.25C14.5 9.7 14.05 9.25 13.5 9.25C12.95 9.25 12.5 9.7 12.5 10.25C12.5 10.8 12.95 11.25 13.5 11.25ZM11.5 4.25C11.5 4.8 11.95 5.25 12.5 5.25C13.05 5.25 13.5 4.8 13.5 4.25C13.5 3.7 13.05 3.25 12.5 3.25C11.95 3.25 11.5 3.7 11.5 4.25Z"
          fill="#FAFAFA"
        />
      </svg>
    ),
    href: 'https://www.reddit.com/r/thorchainofficial/'
  }
]

interface TileProps {
  label: string
  animationData: any
  onClick?: () => void
  disabled?: boolean
}

function MenuTile({ label, animationData, onClick, disabled }: TileProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null)

  const handleMouseEnter = () => {
    if (!disabled) {
      lottieRef.current?.animationItem?.setLoop(true)
      lottieRef.current?.goToAndPlay(0, true)
    }
  }

  const handleMouseLeave = () => {
    lottieRef.current?.animationItem?.setLoop(false)
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || !onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'flex w-full text-left transition-all duration-150',
        'items-center gap-4 border-b border-neutral-800 py-4',
        'sm:aspect-square sm:flex-col sm:justify-between sm:overflow-hidden sm:rounded-xl sm:border sm:border-neutral-800 sm:bg-[#111111] sm:p-5',
        onClick && !disabled ? 'cursor-pointer active:scale-[0.97] sm:hover:bg-neutral-800' : 'cursor-default opacity-40'
      )}
    >
      <div className="text-xl leading-tight font-medium text-white">{label}</div>
      <div className="hidden grow overflow-hidden sm:flex sm:items-end">
        <Lottie lottieRef={lottieRef} animationData={animationData} autoplay={false} loop={false} className="h-full w-full" />
      </div>
    </button>
  )
}

interface SendMemoMenuProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function SendMemoMenu({ isOpen, onOpenChange }: SendMemoMenuProps) {
  const router = useRouter()

  const navigate = (path: string) => {
    router.push(path)
    onOpenChange(false)
  }

  const tiles: TileProps[] = [
    { label: 'Swap', animationData: swapAnim, onClick: () => navigate('/swap') },
    { label: 'Memo', animationData: memoAnim, onClick: () => navigate('/memo') },
    { label: 'Bond', animationData: bondAnim, onClick: () => navigate('/bond') },
    { label: '$TCY', animationData: tcyAnim, onClick: () => navigate('/stake') }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-0 z-50 flex flex-col overflow-auto',
            'bg-black text-white',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-200'
          )}
        >
          <VisuallyHidden>
            <DialogPrimitive.Title>Navigation Menu</DialogPrimitive.Title>
          </VisuallyHidden>

          <div className="flex items-center justify-between px-4 py-4 sm:px-8 sm:py-5 lg:px-16">
            <a
              href={AppConfig.logoLink || '/'}
              className="flex items-center gap-3"
              rel="noopener noreferrer"
              target={AppConfig.logoLink ? '_blank' : '_self'}
            >
              <Image src={AppConfig.logo} alt={AppConfig.title} width={32} height={32} priority />
              <span className="[&_path]:fill-white">
                <AppConfig.LogoText />
              </span>
            </a>

            <DialogPrimitive.Close className="cursor-pointer rounded-sm text-neutral-400 transition-colors hover:text-white" aria-label="Close">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-1 flex-col gap-8 px-4 pt-4 pb-8 sm:px-8 sm:pt-6 lg:flex-row lg:gap-16 lg:px-16 lg:pt-8 lg:pb-12">
            <div className="flex-1">
              <div className="sm:grid sm:grid-cols-2 sm:gap-3 md:grid-cols-4">
                {tiles.map(tile => (
                  <MenuTile key={tile.label} {...tile} />
                ))}
              </div>
            </div>

            <div className="flex w-full flex-col gap-5 lg:w-56 lg:shrink-0">
              <p className="text-xl font-medium text-white">Social</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {SOCIAL_LINKS.map(link => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-neutral-400 transition-colors hover:text-white"
                  >
                    <span className="shrink-0">{link.icon}</span>
                    <span className="text-base">{link.label}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
