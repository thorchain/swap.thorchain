import { Icon } from '@/components/icons'
import { Tooltip } from '@/components/tooltip'
import { AppConfig } from '@/config'
import { Separator } from '../ui/separator'

export function FooterContent({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="text-txt-med-contrast flex items-center justify-between gap-4 text-xs">
        <div className="flex h-4 items-center gap-2">
          <a href={AppConfig.privacyPolicyLink} rel="noopener noreferrer" target="_blank">
            Privacy Policy
          </a>
          <Separator orientation="vertical" className="bg-txt-med-contrast h-full" />
          <a href={AppConfig.tosLink} rel="noopener noreferrer" target="_blank">
            Terms of Use
          </a>
          <Separator orientation="vertical" className="bg-txt-med-contrast h-full" />
          <Tooltip content="While this website is built with care it may have unintended bugs which may lead to site malfunctioning and even loss of funds. Proceed only if you understand and accept these risks.">
            <span className="cursor-default font-semibold text-red-500">Risk Policy</span>
          </Tooltip>
          <Separator orientation="vertical" className="bg-txt-med-contrast h-full" />
          <div className="flex items-center gap-1">
            <span>Built by</span>
            <Icon name="unstoppable" className="size-3" />
            <a className="underline" href="https://x.com/unstoppablebyhs" rel="noopener noreferrer" target="_blank">
              Unstoppable Wallet
            </a>
          </div>
        </div>
        <a className="flex items-center gap-2 underline" href={AppConfig.discordLink} rel="noopener noreferrer" target="_blank">
          Get Support in Discord <Icon width={20} height={20} viewBox="0 0 20 20" name="discord" />
        </a>
      </div>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="bg-body fixed inset-x-0 bottom-0 mx-auto hidden md:block">
      <FooterContent className="container mx-auto border-t p-4" />
    </footer>
  )
}
