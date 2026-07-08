import { Chain } from '@tcswap/core'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { wallet } from '@/components/connect-wallet/config'
import { WalletIcon } from '@/components/wallet-icon'
import { DropdownWalletButton } from '@/components/dropdown-wallet-button'
import { useAssetFrom } from '@/hooks/use-swap'
import { useAccounts, useSelectAccount, useSelectedAccount } from '@/hooks/use-wallets'
import { cn, truncate } from '@/lib/utils'

type SwapAddressFromProps = {
  minOptions?: number
  chain?: Chain
  showAddress?: boolean
}

export const SwapAddressFrom = ({ minOptions = 2, chain, showAddress = true }: SwapAddressFromProps = {}) => {
  const accounts = useAccounts()
  const selectedAccount = useSelectedAccount()
  const selectAccount = useSelectAccount()
  const assetFrom = useAssetFrom()

  const network = chain ?? assetFrom?.chain
  const options = accounts.filter(a => a.network === network)

  if (!selectedAccount || options.length < minOptions) return null

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <DropdownWalletButton>
          <span className="flex items-center gap-1">
            <WalletIcon walletKey={selectedAccount.provider.toLowerCase()} width={18} height={18} />
            {showAddress && truncate(selectedAccount.address)}
          </span>
        </DropdownWalletButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div>
          {options?.map((account, index) => (
            <DropdownMenuItem
              key={index}
              className="bg-btn-style-1-bg focus:bg-sub-container-modal/50 flex cursor-pointer items-center justify-between gap-4 rounded-none px-4 py-3"
              onSelect={() => selectAccount(account)}
            >
              <div className="flex items-center gap-4">
                <WalletIcon walletKey={account.provider.toLowerCase()} width={20} height={20} />
                <span className="text-txt-label-small text-xs font-semibold">{wallet(account.provider)?.label}</span>
              </div>
              <span
                className={cn('ms-5 text-xs font-semibold', {
                  'text-green-contrast': account.provider === selectedAccount?.provider && account.address === selectedAccount?.address
                })}
              >
                {truncate(account.address)}
              </span>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
