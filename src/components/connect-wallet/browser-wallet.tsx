import { useState } from 'react'
import { Chain, WalletOption } from '@tcswap/core'
import { LoaderCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChainSelect } from '@/components/connect-wallet/chain-select'
import { ALL_CHAINS, chainLabel, WalletParams } from '@/components/connect-wallet/config'
import { GenericButton } from '@/components/generic-button'
import { useWallets } from '@/hooks/use-wallets'

export const BrowserWallet = ({ wallet, chains, onConnect }: { wallet: WalletParams; chains: (Chain | string)[]; onConnect: () => void }) => {
  const t = useTranslations('wallet')
  const availableChains: (Chain | string)[] = wallet.supportedChains.filter(c => ALL_CHAINS.includes(c))

  const [connecting, setConnecting] = useState(false)
  const [selectedChains, setSelectedChains] = useState<(Chain | string)[]>(availableChains)
  const { connect } = useWallets()

  // WalletConnect's errors are SDK keys; the user reads what went wrong instead.
  const describeWalletconnectError = (error: unknown) => {
    const message = error instanceof Error ? error.message : ''
    if (message.startsWith('wallet_walletconnect_chain_not_supported')) return t('walletconnectNoChains')
    if (message.includes('did not load')) return t('walletconnectNotLoaded')
    if (message.startsWith('wallet_walletconnect_')) return t('walletconnectNotConnected')
  }

  const handleConnect = async () => {
    // WalletConnect opens its own QR modal, which this dialog would sit over and block clicks on.
    const closeFirst = wallet.option === WalletOption.WALLETCONNECT
    if (closeFirst) onConnect()
    setConnecting(true)

    connect(
      wallet.option,
      selectedChains.map(c => c as Chain),
      undefined,
      wallet.option === WalletOption.WALLETCONNECT ? describeWalletconnectError : undefined
    )
      .then(accounts => {
        // A wallet may connect only some of the chains — WalletConnect wallets approve those they support.
        const missing = accounts.length > 0 ? selectedChains.filter(c => !accounts.some(a => a.network === c)) : []
        if (missing.length > 0) {
          toast.warning(t('chainsNotConnected', { name: wallet.label, chains: missing.map(chainLabel).join(', ') }))
        }
        if (!closeFirst) onConnect()
      })
      .catch(err => {
        console.log(err.message)
      })
      .finally(() => {
        setConnecting(false)
      })
  }

  const filteredChains = chains.filter(c => availableChains.includes(c))

  return (
    <>
      <ChainSelect chains={filteredChains} selectedChains={selectedChains} onChange={setSelectedChains} />

      <div className="flex p-4 pt-2 md:justify-end md:px-8 md:pb-8">
        <GenericButton
          colorType="3"
          size="large"
          className="w-full md:w-auto"
          disabled={connecting || selectedChains.length === 0}
          onClick={() => handleConnect()}
        >
          {connecting && <LoaderCircle size={20} className="animate-spin" />}
          {t('connectNamed', { name: wallet.label })}
        </GenericButton>
      </div>
    </>
  )
}
