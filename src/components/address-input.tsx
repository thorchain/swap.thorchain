'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { WalletIcon } from '@/components/wallet-icon'
import { Icon } from '@/components/icons'
import { GenericButton } from '@/components/generic-button'
import { Tooltip } from '@/components/tooltip'
import { WalletAccount } from '@/store/wallets-store'
import { cn, truncate } from '@/lib/utils'

interface AddressInputProps {
  value: string
  onChange: (value: string) => void
  // Connected accounts (on the relevant chain) offered as one-tap quick-fill.
  options?: WalletAccount[]
  placeholder?: string
  invalid?: boolean
  className?: string
}

export function AddressInput({ value, onChange, options = [], placeholder, invalid, className }: AddressInputProps) {
  const t = useTranslations('send')
  const currentOption = options.find(a => a.address.toLowerCase() === value.toLowerCase())

  return (
    <div className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid}
        onChange={e => onChange(e.target.value)}
        className={cn('bg-input-modal-bg-active border-border-sub-container-modal-low pr-12', currentOption && 'pl-12', className)}
      />

      {currentOption && (
        <WalletIcon
          walletKey={currentOption.provider.toLowerCase()}
          alt={currentOption.provider}
          width={24}
          height={24}
          className="absolute top-1/2 left-4 -translate-y-1/2"
        />
      )}

      {value.length ? (
        <GenericButton size="small" icon={<Icon name="trash" />} className="absolute end-3 top-1/2 -translate-y-1/2" onClick={() => onChange('')} />
      ) : (
        <div className="absolute end-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {options.map((account, index) => (
            <Tooltip key={index} content={truncate(account.address)}>
              <GenericButton
                size="small"
                className="rounded-xl"
                icon={<WalletIcon walletKey={account.provider.toLowerCase()} alt={account.provider} width={24} height={24} />}
                onClick={() => onChange(account.address)}
              />
            </Tooltip>
          ))}
          <GenericButton size="small" onClick={() => navigator.clipboard.readText().then(text => onChange(text.trim()))}>
            {t('paste')}
          </GenericButton>
        </div>
      )}
    </div>
  )
}
