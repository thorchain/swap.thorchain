'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Info, LoaderCircle, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useDialog } from '@/components/global-dialog'
import { ConnectWallet } from '@/components/connect-wallet/connect-wallet'
import { GenericButton } from '@/components/generic-button'
import { NameRecord, ThornameConfig, aliasesOf, formatPreferredAsset, preferredAssetOf } from '@/components/send-memo/thorname/thorname-config'
import {
  ThornameAddressesDialog,
  ThornameRegisterDialog,
  ThornameRenewDialog,
  ThornameTransferDialog
} from '@/components/send-memo/thorname/thorname-dialogs'
import { useExternalWalletMode, useSelectedAccount, useSetExternalWalletMode } from '@/hooks/use-wallets'
import { useResolveAccount } from '@/hooks/use-resolve-account'
import { blockHeightToDate } from '@/components/send-memo/send-memo-helpers'
import { WalletAccount } from '@/store/wallets-store'
import { truncate } from '@/lib/utils'

export function ThornameView({ config }: { config: ThornameConfig }) {
  const t = useTranslations('send')
  const { openDialog } = useDialog()
  const externalWalletMode = useExternalWalletMode()
  const setExternalWalletMode = useSetExternalWalletMode()

  useResolveAccount(config.chain)

  const account = useSelectedAccount()
  const { currentBlock } = config.useNetwork()

  const [search, setSearch] = useState('')

  const { names: ownedNames } = config.useNamesOwned(account?.address)
  const { details: ownedDetails } = config.useName(ownedNames)
  const { items, isLoading: lookupLoading, isError: lookupError } = config.useName(search ? [search] : [])
  const found = items[0] ?? null

  const trimmed = search.trim()
  // Available only once the lookup confirms it's unregistered — never on error.
  const isAvailable = trimmed.length > 0 && !lookupLoading && !lookupError && !found

  const withWallet = (proceed: (account: WalletAccount) => void) => {
    if (externalWalletMode) setExternalWalletMode(false)
    if (account) proceed(account)
    else openDialog(ConnectWallet, { chain: config.chain })
  }

  const openRegister = (name: string) => withWallet(acc => openDialog(ThornameRegisterDialog, { config, name, account: acc }))
  const openRenew = (name: string, expireBlockHeight: number) =>
    withWallet(acc => openDialog(ThornameRenewDialog, { config, name, account: acc, expireBlockHeight }))
  const openTransfer = (name: string) => withWallet(acc => openDialog(ThornameTransferDialog, { config, name, account: acc }))
  const openAddress = (record: NameRecord) =>
    withWallet(acc => openDialog(ThornameAddressesDialog, { config, name: record.name, account: acc, record }))

  return (
    <div className="bg-modal rounded-20 space-y-2.5 border p-2.5">
      {/* Search */}
      <div className="relative">
        <Search className="text-txt-label-small absolute top-1/2 left-4 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value.toLowerCase())}
          placeholder={t('thorname.searchPlaceholder', { name: config.label })}
          className="bg-swap-bloc border-border-sub-container-modal-low pr-20 pl-11"
        />
        {search ? (
          <GenericButton size="small" icon={<X className="size-4" />} className="absolute end-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')} />
        ) : (
          <GenericButton
            size="small"
            className="absolute end-3 top-1/2 -translate-y-1/2"
            onClick={() => navigator.clipboard.readText().then(text => setSearch(text.trim().toLowerCase()))}
          >
            {t('paste')}
          </GenericButton>
        )}
      </div>

      {/* Search result */}
      {trimmed && (
        <>
          {lookupLoading ? (
            <div className="bg-swap-bloc rounded-15 flex items-center justify-center border py-8">
              <LoaderCircle size={18} className="text-txt-label-small animate-spin" />
            </div>
          ) : lookupError ? (
            <div className="bg-swap-bloc rounded-15 text-txt-label-small flex items-center justify-center gap-2 border py-8 text-sm">
              <Info className="size-4" />
              {t('thorname.lookupError')}
            </div>
          ) : isAvailable ? (
            <NameCard config={config} name={trimmed} status="available" onRegister={() => openRegister(trimmed)} />
          ) : found ? (
            <NameCard
              config={config}
              name={found.name}
              status={account && found.owner === account.address ? 'owned' : 'taken'}
              record={found}
              expiryDate={blockHeightToDate(found.expire_block_height, currentBlock)}
              onRenew={() => openRenew(found.name, found.expire_block_height)}
              onTransfer={() => openTransfer(found.name)}
              onManage={() => openAddress(found)}
            />
          ) : null}
        </>
      )}

      {/* Owned names */}
      {!trimmed &&
        account &&
        ownedDetails.map(n => (
          <NameCard
            key={n.name}
            config={config}
            name={n.name}
            status="owned"
            record={n}
            expiryDate={blockHeightToDate(n.expire_block_height, currentBlock)}
            onRenew={() => openRenew(n.name, n.expire_block_height)}
            onTransfer={() => openTransfer(n.name)}
            onManage={() => openAddress(n)}
          />
        ))}
    </div>
  )
}

type NameCardProps = {
  config: ThornameConfig
  name: string
  status: 'owned' | 'taken' | 'available'
  record?: NameRecord
  expiryDate?: Date | null
  onRegister?: () => void
  onRenew?: () => void
  onTransfer?: () => void
  onManage?: () => void
}

function NameCard({ config, name, status, record, expiryDate, onRegister, onRenew, onTransfer, onManage }: NameCardProps) {
  const t = useTranslations('send')
  // A name with no aliases yet still gets a row, using the owner address.
  const aliases = aliasesOf(record)
  const rows = aliases.length > 0 ? aliases : record?.owner ? [{ chain: config.aliasChain, address: record.owner }] : []
  const preferredAsset = preferredAssetOf(record)

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
          {rows.map(a => (
            <Row key={a.chain} label={t('thorname.aliasAddress', { chain: a.chain })} value={truncate(a.address)} />
          ))}
          {preferredAsset && <Row label={t('thorname.preferredAsset')} value={formatPreferredAsset(preferredAsset)} />}
        </div>
      )}

      {status === 'owned' && (
        <div className="flex flex-wrap justify-end gap-2">
          <GenericButton size="small" onClick={onManage}>
            {t('thorname.manage')}
          </GenericButton>
          <GenericButton size="small" onClick={onRenew}>
            {t('thorname.renew')}
          </GenericButton>
          <GenericButton size="small" onClick={onTransfer}>
            {t('thorname.transfer')}
          </GenericButton>
        </div>
      )}

      {status === 'available' && (
        <div className="flex justify-end">
          <GenericButton colorType="3" size="small" onClick={onRegister}>
            {t('thorname.register')}
          </GenericButton>
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
