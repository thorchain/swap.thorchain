'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Chain } from '@tcswap/core'
import { CheckCircle2, Info, LoaderCircle, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useDialog } from '@/components/global-dialog'
import { ConnectWallet } from '@/components/connect-wallet/connect-wallet'
import { ThemeButton } from '@/components/theme-button'
import { SendMemoBeta } from '@/components/send-memo/send-memo-beta'
import { SwapAddressFrom } from '@/components/swap/swap-address-from'
import { ThornameRegisterDialog, ThornameRenewDialog, ThornameTransferDialog } from '@/components/send-memo/thorname/thorname-dialogs'
import { useExternalWalletMode, useSelectedAccount, useSetExternalWalletMode } from '@/hooks/use-wallets'
import { useResolveThorAccount } from '@/hooks/use-resolve-thor-account'
import { useThorName } from '@/hooks/use-thorname'
import { useThorNamesOwned } from '@/hooks/use-thornames-owned'
import { blockHeightToDate, useThorNetwork } from '@/hooks/use-thor-network'
import { ThorName } from '@/lib/thorchain-api'
import { WalletAccount } from '@/store/wallets-store'
import { cn, truncate } from '@/lib/utils'

type NameTab = 'thorname' | 'mayaname'

export function Thorname() {
  const t = useTranslations('send')
  const { openDialog } = useDialog()
  const externalWalletMode = useExternalWalletMode()
  const setExternalWalletMode = useSetExternalWalletMode()

  useResolveThorAccount()

  const thorAccount = useSelectedAccount()
  const { currentBlock } = useThorNetwork()

  const [tab, setTab] = useState<NameTab>('thorname')
  const [search, setSearch] = useState('')

  const { names: ownedNames } = useThorNamesOwned(thorAccount?.address)
  const { details: ownedDetails } = useThorName(ownedNames)
  const { thorNames, isLoading: lookupLoading } = useThorName(search ? [search] : [])
  const thorName = thorNames[0] ?? null

  const trimmed = search.trim()
  const isAvailable = trimmed.length > 0 && !lookupLoading && !thorName

  const withWallet = (proceed: (account: WalletAccount) => void) => {
    if (externalWalletMode) setExternalWalletMode(false)
    if (thorAccount) proceed(thorAccount)
    else openDialog(ConnectWallet, { chain: Chain.THORChain })
  }

  const openRegister = (name: string) => withWallet(account => openDialog(ThornameRegisterDialog, { name, thorAccount: account }))
  const openRenew = (name: string) => withWallet(account => openDialog(ThornameRenewDialog, { name, thorAccount: account }))
  const openTransfer = (name: string) => withWallet(account => openDialog(ThornameTransferDialog, { name, thorAccount: account }))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xl font-medium">
          <span
            onClick={() => setTab('thorname')}
            className={cn('cursor-pointer transition-colors', tab === 'thorname' ? 'text-txt-contrast-1-default' : 'text-txt-text-modal')}
          >
            {t('thorname.tab.thorname')}
          </span>
          <span className="text-txt-text-modal/60 cursor-not-allowed">{t('thorname.tab.mayaname')}</span>
        </div>
        {thorAccount && (
          <div className="shrink-0">
            <SwapAddressFrom chain={Chain.THORChain} showAddress={false} />
          </div>
        )}
      </div>

      <div className="bg-modal rounded-20 space-y-2.5 border p-2.5">
        {/* Search */}
        <div className="relative">
          <Search className="text-txt-label-small absolute top-1/2 left-4 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value.toLowerCase())}
            placeholder={t('thorname.searchPlaceholder')}
            className="bg-swap-bloc border-border-sub-container-modal-low pr-20 pl-11"
          />
          {search ? (
            <ThemeButton variant="circleSmall" className="absolute end-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
              <X className="size-4" />
            </ThemeButton>
          ) : (
            <ThemeButton
              variant="secondarySmall"
              className="absolute end-3 top-1/2 -translate-y-1/2"
              onClick={() => navigator.clipboard.readText().then(text => setSearch(text.trim().toLowerCase()))}
            >
              {t('paste')}
            </ThemeButton>
          )}
        </div>

        {/* Search result */}
        {trimmed && (
          <>
            {lookupLoading ? (
              <div className="bg-swap-bloc rounded-15 flex items-center justify-center border py-8">
                <LoaderCircle size={18} className="text-txt-label-small animate-spin" />
              </div>
            ) : isAvailable ? (
              <NameCard name={trimmed} status="available" onRegister={() => openRegister(trimmed)} />
            ) : thorName ? (
              <NameCard
                name={thorName.name}
                status={thorAccount && thorName.owner === thorAccount.address ? 'owned' : 'taken'}
                thorName={thorName}
                expiryDate={blockHeightToDate(thorName.expire_block_height, currentBlock)}
                onRenew={() => openRenew(thorName.name)}
                onTransfer={() => openTransfer(thorName.name)}
              />
            ) : null}
          </>
        )}

        {/* Owned names */}
        {!trimmed &&
          thorAccount &&
          ownedDetails.map(n => (
            <NameCard
              key={n.name}
              name={n.name}
              status="owned"
              thorName={n}
              expiryDate={blockHeightToDate(n.expire_block_height, currentBlock)}
              onRenew={() => openRenew(n.name)}
              onTransfer={() => openTransfer(n.name)}
            />
          ))}
      </div>

      <SendMemoBeta />
    </div>
  )
}

type NameCardProps = {
  name: string
  status: 'owned' | 'taken' | 'available'
  thorName?: ThorName
  expiryDate?: Date | null
  onRegister?: () => void
  onRenew?: () => void
  onTransfer?: () => void
}

function NameCard({ name, status, thorName, expiryDate, onRegister, onRenew, onTransfer }: NameCardProps) {
  const t = useTranslations('send')
  const thorAlias = thorName?.aliases?.find(a => a.chain === 'THOR')?.address ?? thorName?.owner

  return (
    <div className="bg-swap-bloc rounded-15 space-y-3 border p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-txt-high-contrast text-2xl font-semibold break-all">{name}</span>
        {status === 'owned' && (
          <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-sky-500">
            <Info className="size-4" />
            {t('thorname.yours')}
          </span>
        )}
        {status === 'taken' && (
          <span className="text-jacob flex shrink-0 items-center gap-1 text-sm font-medium">
            <Info className="size-4" />
            {t('thorname.takenLabel')}
          </span>
        )}
        {status === 'available' && (
          <span className="text-green-contrast flex shrink-0 items-center gap-1 text-sm font-medium">
            <CheckCircle2 className="size-4" />
            {t('thorname.availableLabel')}
          </span>
        )}
      </div>

      {status !== 'available' && (
        <div className="space-y-2">
          {expiryDate && <Row label={t('thorname.expires')} value={expiryDate.toLocaleDateString()} />}
          {thorAlias && <Row label={t('thorname.aliasesChain', { chain: 'THOR' })} value={truncate(thorAlias)} />}
        </div>
      )}

      {status === 'owned' && (
        <div className="flex justify-end gap-2">
          <ThemeButton variant="secondarySmall" className="rounded-full" onClick={onRenew}>
            {t('thorname.renew')}
          </ThemeButton>
          <ThemeButton variant="secondarySmall" className="rounded-full" onClick={onTransfer}>
            {t('thorname.transfer')}
          </ThemeButton>
        </div>
      )}

      {status === 'available' && (
        <div className="flex justify-end">
          <ThemeButton variant="primarySmall" className="rounded-full" onClick={onRegister}>
            {t('thorname.register')}
          </ThemeButton>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-txt-label-small">{label}</span>
      <span className="text-txt-high-contrast font-medium">{value}</span>
    </div>
  )
}
