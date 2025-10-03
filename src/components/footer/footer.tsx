'use client'

import { Icon } from '@/components/icons'

export function Footer() {
  return (
    <footer className="bg-tyler fixed inset-x-0 bottom-0 mx-auto hidden md:block">
      <div className="border-blade container mx-auto border-t px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="text-thor-gray flex items-center gap-1 text-xs">
            <span>Built by</span>
            <Icon name="unstoppable" className="size-3" />
            <a className="underline" href="https://x.com/unstoppablebyhs" rel="noopener noreferrer" target="_blank">
              Unstoppable Wallet
            </a>
          </div>

          <div
            className="flex size-8 cursor-pointer items-center justify-center"
            onClick={() => window.open(`https://x.com/unstoppablebyhs`, '_blank')}
          >
            <Icon name="x" className="text-thor-gray size-3" />
          </div>
        </div>
      </div>
    </footer>
  )
}
