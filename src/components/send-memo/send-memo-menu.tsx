'use client'

import Image from 'next/image'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogPortal } from '@/components/ui/dialog'
import { FooterContent } from '@/components/footer/footer'
import { AppConfig } from '@/config'
import { cn } from '@/lib/utils'

const SOCIAL_LINKS = {
  left: [
    {
      label: 'X (Twitter)',
      icon: (
        <svg width="20" height="19" viewBox="0 0 20 19" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15.8014 0H18.867L12.136 8.06273L20 19H13.8287L8.997 12.3535L3.46551 19H0.399867L7.53082 10.3764L0 0H6.32456L10.6898 6.07159L15.8014 0ZM14.7284 17.107H16.4279L5.43152 1.82288H3.60546L14.7284 17.107Z" fill="#FAFAFA"/>
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
    }
  ]
}

interface TileProps {
  label: string
  icon: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}

function MenuTile({ label, icon, onClick, disabled }: TileProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || !onClick}
      className={cn(
        'relative flex h-36 w-full flex-col justify-between overflow-hidden rounded-xl p-4 text-left transition-all duration-150 sm:h-52 md:h-64 lg:h-72',
        'bg-[#1c1e26]',
        onClick && !disabled ? 'cursor-pointer hover:bg-[#22243060] active:scale-[0.97]' : 'cursor-default opacity-40'
      )}
    >
      <div className="relative text-2xl leading-tight font-medium text-neutral-50">{label}</div>
      <div className="overflow-hidden">{icon}</div>
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
    {
      label: 'Swap',
      icon: (
        <svg width="249" height="210" viewBox="0 0 249 210" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="84.125" cy="104.625" r="50" fill="#03CFFA" />
          <circle cx="164.125" cy="104.625" r="50" fill="#BCB5FB" />
        </svg>
      ),
      onClick: () => navigate('/swap')
    },
    {
      label: 'Memo',
      icon: (
        <svg width="249" height="210" viewBox="0 0 249 210" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M143.901 55.3033C144.241 54.9633 144.792 54.9633 145.132 55.3033L173.447 83.6183C173.787 83.9583 173.787 84.5095 173.447 84.8494L100.812 157.484C100.472 157.824 99.9213 157.824 99.5813 157.484L71.2663 129.169C70.9263 128.829 70.9263 128.278 71.2663 127.938L143.901 55.3033Z"
            fill="white"
          />
          <path
            d="M156.519 42.6846C160.599 38.6051 167.213 38.6051 171.292 42.6846L186.065 57.4577C190.145 61.5372 190.145 68.1513 186.065 72.2308L179.294 79.0017C178.954 79.3417 178.403 79.3417 178.063 79.0017L149.748 50.6867C149.408 50.3467 149.408 49.7956 149.748 49.4556L156.519 42.6846Z"
            fill="#BCB5FB"
          />
          <path
            d="M65.7152 134.765C65.8515 134.083 66.6927 133.828 67.1843 134.32L94.4301 161.566C94.9218 162.057 94.6671 162.898 93.9853 163.035L61.2084 169.59C59.9902 169.834 58.9161 168.76 59.1598 167.542L65.7152 134.765Z"
            fill="#31FD9D"
          />
        </svg>
      ),
      onClick: () => navigate('/memo')
    },
    {
      label: 'Bond',
      icon: (
        <svg width="249" height="210" viewBox="0 0 249 210" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="16" transform="matrix(1 2.18557e-08 2.18557e-08 -1 140.124 64.625)" fill="#03CFFA" />
          <circle cx="16" cy="16" r="16" transform="matrix(1 2.18557e-08 2.18557e-08 -1 44.1243 120.625)" fill="#31FD9D" />
          <circle cx="16" cy="16" r="16" transform="matrix(1 2.18557e-08 2.18557e-08 -1 140.124 176.625)" fill="#31FD9D" />
          <circle cx="124.126" cy="103.627" r="64" fill="white" />
          <circle cx="16" cy="16" r="16" transform="matrix(1 2.18557e-08 2.18557e-08 -1 172.126 120.624)" fill="#FFEE56" />
          <circle cx="16" cy="16" r="16" transform="matrix(1 2.18557e-08 2.18557e-08 -1 108.124 120.625)" fill="#BCB5FB" />
          <circle cx="16" cy="16" r="16" transform="matrix(1 2.18557e-08 2.18557e-08 -1 76.124 176.625)" fill="#03CFFA" />
          <circle cx="16" cy="16" r="16" transform="matrix(1 2.18557e-08 2.18557e-08 -1 76.124 64.625)" fill="#FFEE56" />
        </svg>
      ),
      onClick: () => navigate('/bond')
    },
    {
      label: '$TCY',
      icon: (
        <svg width="249" height="210" viewBox="0 0 249 210" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="124.125" cy="104.625" r="65.375" fill="#03CFFA" />
          <path
            d="M93.9531 140.481L142.39 119.098L127.057 102.799L93.9531 140.481ZM111.747 86.5244L127.081 102.799L154.452 67.7461L111.747 86.5244Z"
            fill="white"
          />
        </svg>
      ),
      onClick: () => navigate('/stake')
    },
    {
      label: 'Pool',
      icon: (
        <svg width="248" height="209" viewBox="0 0 248 209" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M169 124.219C169 90.8719 137.883 54.4022 127.4 43.0627C125.537 41.0472 122.463 41.0472 120.6 43.0627C110.117 54.4022 79 90.8719 79 124.219C79 149.227 99.1472 169.5 124 169.5C148.853 169.5 169 149.227 169 124.219Z"
            fill="#31FD9D"
          />
        </svg>
      ),
      disabled: true
    },
    {
      label: 'THORName',
      icon: (
        <svg width="248" height="209" viewBox="0 0 248 209" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="124.001" cy="69.6715" rx="24.4742" ry="24.4742" fill="#FFEE56" />
          <path
            d="M74.0001 143.794C74.0001 116.18 96.3859 101.794 124 101.794C151.614 101.794 174 116.18 174 143.794C174 170.473 74.0001 170.473 74.0001 143.794Z"
            fill="#03CFFA"
          />
        </svg>
      ),
      disabled: true
    },
    {
      label: 'Node Operators',
      icon: (
        <svg width="248" height="209" viewBox="0 0 248 209" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M56.2079 107.461C59.302 105.675 63.1139 105.675 66.2079 107.461L83.2352 117.292C86.3292 119.078 88.2352 122.379 88.2352 125.952V145.613C88.2352 149.186 86.3292 152.487 83.2352 154.274L66.2079 164.104C63.1139 165.891 59.302 165.891 56.2079 164.104L39.1806 154.274C36.0866 152.487 34.1806 149.186 34.1806 145.613V125.952C34.1806 122.379 36.0866 119.078 39.1806 117.292L56.2079 107.461Z"
            fill="white"
          />
          <path
            d="M181.791 107.461C184.885 105.675 188.697 105.675 191.791 107.461L208.819 117.292C211.913 119.078 213.819 122.379 213.819 125.952V145.613C213.819 149.186 211.913 152.487 208.819 154.274L191.791 164.104C188.697 165.891 184.885 165.891 181.791 164.104L164.764 154.274C161.67 152.487 159.764 149.186 159.764 145.613V125.952C159.764 122.379 161.67 119.078 164.764 117.292L181.791 107.461Z"
            fill="#FFEE56"
          />
          <path
            d="M119 44.8965C122.094 43.1102 125.906 43.1102 129 44.8965L151.576 57.9309C154.67 59.7172 156.576 63.0185 156.576 66.5911V92.6599C156.576 96.2325 154.67 99.5338 151.576 101.32L129 114.355C125.906 116.141 122.094 116.141 119 114.355L96.4238 101.32C93.3298 99.5338 91.4238 96.2325 91.4238 92.6599V66.5911C91.4238 63.0185 93.3298 59.7172 96.4238 57.9309L119 44.8965Z"
            fill="#03CFFA"
          />
          <circle cx="61.5" cy="72.5" r="10.5" fill="white" />
          <circle cx="186.5" cy="72.5" r="10.5" fill="#03CFFA" />
          <circle cx="123.5" cy="143.5" r="10.5" fill="#FFEE56" />
        </svg>
      ),
      disabled: true
    }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-0 z-50 flex flex-col',
            'bg-[#0d0e14] text-white',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'duration-200'
          )}
        >
          <VisuallyHidden>
            <DialogPrimitive.Title>Navigation Menu</DialogPrimitive.Title>
          </VisuallyHidden>

          <div className="flex items-center justify-between px-4 py-4 sm:px-8 sm:py-5">
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

            <DialogPrimitive.Close className="text-txt-label-small hover:text-txt-high-contrast cursor-pointer rounded-sm transition-colors" aria-label="Close">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-1 flex-col gap-6 overflow-auto px-4 pb-4 sm:px-8 sm:pb-8 lg:flex-row lg:gap-12">
            <div className="flex flex-1 flex-col gap-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {tiles.slice(0, 4).map(tile => (
                  <MenuTile key={tile.label} {...tile} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {tiles.slice(4).map(tile => (
                  <MenuTile key={tile.label} {...tile} />
                ))}
              </div>
            </div>

            <div className="flex w-full flex-col gap-6 pt-1 lg:w-60 lg:shrink-0">
              <div>
                <p className="mb-3 text-xl font-medium text-white">Social</p>
                <div className="flex gap-8">
                  <div className="flex flex-col gap-2">
                    {SOCIAL_LINKS.left.map(link => (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-txt-label-small flex items-center gap-2 text-lg transition-colors"
                      >
                        {link.icon}
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <FooterContent className="border-stroke-menu border-t px-4 py-3 pb-4 sm:px-8" />
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
