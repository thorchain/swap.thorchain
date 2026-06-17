'use client'

import { useState } from 'react'
import { SendMemoBeta } from '@/components/send-memo/send-memo-beta'
import { SwapAddressFrom } from '@/components/swap/swap-address-from'
import { ThornameView } from '@/components/send-memo/thorname/thorname-view'
import { THORNAME_CONFIGS, ThornameConfig } from '@/components/send-memo/thorname/thorname-config'
import { useSelectedAccount } from '@/hooks/use-wallets'
import { cn } from '@/lib/utils'

const TABS: ThornameConfig['key'][] = ['thorname', 'mayaname']

export function Thorname() {
  const [tab, setTab] = useState<ThornameConfig['key']>('thorname')
  const config = THORNAME_CONFIGS[tab]
  const account = useSelectedAccount()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xl font-medium">
          {TABS.map(key => (
            <span
              key={key}
              onClick={() => setTab(key)}
              className={cn('cursor-pointer transition-colors', tab === key ? 'text-txt-contrast-1-default' : 'text-txt-text-modal')}
            >
              {THORNAME_CONFIGS[key].label}
            </span>
          ))}
        </div>
        {account?.network === config.chain && (
          <div className="shrink-0">
            <SwapAddressFrom chain={config.chain} showAddress={false} />
          </div>
        )}
      </div>

      <ThornameView key={tab} config={config} />

      <SendMemoBeta />
    </div>
  )
}
