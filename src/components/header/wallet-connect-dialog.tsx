import Image from 'next/image'
import { useMemo, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Chain, WalletOption } from '@swapkit/helpers'
import { ThemeButton } from '@/components/theme-button'
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { WalletConnectLedger } from '@/components/header/wallet-connect-ledger'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useDialog } from '@/components/global-dialog'
import { useAccounts } from '@/hooks/use-wallets'
import { supportedChains } from '@/lib/wallets'

enum WalletType {
  browser,
  hardware
}

interface WalletProps {
  key: string
  type: WalletType
  label: string
  option: WalletOption
  link: string
  supportedChains: Chain[]
}

interface WalletConnectDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export const WalletConnectDialog = ({ isOpen, onOpenChange }: WalletConnectDialogProps) => {
  const [connecting, setConnecting] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<WalletProps | undefined>(undefined)
  const [selectedChain, setSelectedChain] = useState<Chain | undefined>(undefined)
  const { connect, connectedWallets } = useAccounts()
  const { openDialog } = useDialog()

  const networks = AllChains
  const wallets = useMemo(() => {
    const installed: WalletProps[] = []
    const others: WalletProps[] = []

    WALLETS.forEach(wallet => {
      installed.push(wallet)
      // if (isAvailable(wallet.option)) {
      // } else {
      //   others.push(wallet)
      // }
    })

    const sortByLabel = (a: WalletProps, b: WalletProps) => a.label.localeCompare(b.label)

    installed.sort(sortByLabel)
    others.sort(sortByLabel)

    const getWalletsByType = (type: WalletType) => [
      ...installed.filter(w => w.type === type),
      ...others.filter(w => w.type === type)
    ]

    return {
      [WalletType.browser]: getWalletsByType(WalletType.browser),
      [WalletType.hardware]: getWalletsByType(WalletType.hardware)
    }
  }, [])

  const onSelectWallet = (wallet: WalletProps) => {
    setSelectedWallet(prev => {
      if (prev === wallet) {
        return undefined
      }

      if (wallet.key === 'ledger') {
        openDialog(WalletConnectLedger, {})
      }

      return wallet
    })
    setSelectedChain(undefined)
  }

  const onSelectChain = (chain: Chain) => {
    setSelectedChain(prev => (prev === chain ? undefined : chain))
    setSelectedWallet(undefined)
  }

  const isWalletHighlighted = (walletOption: WalletOption) => {
    if (!selectedChain) return true

    const wallet = WALLETS.find(w => w.option === walletOption)
    return wallet && wallet.supportedChains.includes(selectedChain)
  }

  const isChainHighlighted = (chain: Chain) => {
    if (!selectedWallet) return true
    return selectedWallet.supportedChains.includes(chain)
  }

  const handleConnect = async () => {
    if (!selectedWallet) return
    setConnecting(true)
    await connect(selectedWallet.option, selectedWallet.supportedChains).finally(() => {
      setConnecting(false)
    })
  }

  const walletList = (wallets: WalletProps[]) => {
    return wallets.map((wallet, index) => {
      const isConnected = connectedWallets.find(w => w === wallet.option)
      const isInstalled = true // isAvailable(wallet.option)
      const isSelected = wallet === selectedWallet
      const isHighlighted = isWalletHighlighted(wallet.option)

      return (
        <div
          key={index}
          className={cn('mb-1 flex items-center space-x-3 rounded-2xl border-1 border-transparent p-3', {
            'border-runes-blue': isSelected,
            'opacity-25': !isHighlighted,
            'hover:bg-blade cursor-pointer': isInstalled && !isConnected,
            'mb-4 md:mb-8': index === wallets.length - 1
          })}
          onClick={() => {
            if (isConnected || !isInstalled) return
            onSelectWallet(wallet)
          }}
        >
          <Image src={`/wallets/${wallet.key}.svg`} alt="" width="32" height="32" />
          <div className="flex-1">
            <div className="text-leah font-medium">{wallet.label}</div>
            <div className="text-xs">
              {isInstalled ? (
                isConnected ? (
                  <span className="text-liquidity-green">Connected</span>
                ) : (
                  <span>Disconnected</span>
                )
              ) : (
                <a href={wallet.link} className="text-jacob" rel="noopener noreferrer" target="_blank">
                  Install
                </a>
              )}
            </div>
          </div>
        </div>
      )
    })
  }

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent>
        <CredenzaHeader>
          <CredenzaTitle>Connect Wallet</CredenzaTitle>
        </CredenzaHeader>

        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
          <ScrollArea className="overflow-hidden md:mb-0 md:w-2/5 md:border-r md:pr-8 md:pl-8">
            <div className="mx-4 block gap-2 md:mx-0 md:block md:w-full">
              <div className="text-thor-gray mb-3 text-base font-semibold md:block">Browser Wallets</div>
              {walletList(wallets[WalletType.browser])}

              <div className="text-thor-gray mb-3 text-base font-semibold md:block">Hardware & Keystore</div>
              {walletList(wallets[WalletType.hardware])}
            </div>
          </ScrollArea>

          <div className="flex flex-col md:flex-1 md:overflow-hidden">
            <div className="text-thor-gray mb-3 hidden px-8 text-base font-semibold md:block">Chains</div>

            <div className="hidden flex-1 overflow-hidden md:flex">
              <ScrollArea className="mb-4 flex-1 px-8">
                <div
                  className="grid flex-1 grid-flow-col gap-2"
                  style={{
                    gridTemplateRows: `repeat(${Math.ceil(networks.length / 2)}, minmax(0, 1fr))`,
                    gridTemplateColumns: 'repeat(2, 1fr)'
                  }}
                >
                  {networks.map(chain => {
                    const isSelected = selectedChain === chain
                    const isHighlighted = isChainHighlighted(chain)
                    const isComingSoon = chain === Chain.Solana

                    return (
                      <div
                        key={chain}
                        className={cn(
                          'flex items-center gap-3 rounded-2xl border-1 border-transparent px-4 py-3',
                          {
                            'border-runes-blue': isSelected,
                            'opacity-25': !isHighlighted,
                            'cursor-pointer hover:bg-blade': !isComingSoon
                          }
                        )}
                        onClick={() => onSelectChain(chain)}
                      >
                        <Image src={`/networks/${chain.toLowerCase()}.svg`} alt={chain} width="24" height="24" />
                        <div className="flex items-center gap-3 text-sm">
                          {chain}
                          {isComingSoon ? <Image src="/soon.svg" alt="Soon" width={37} height={17} /> : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="flex p-4 md:justify-end md:px-8 md:pt-0 md:pb-8">
              <ThemeButton
                variant="primaryMedium"
                className="w-full md:w-auto"
                disabled={!selectedWallet || connecting}
                onClick={() => handleConnect()}
              >
                {connecting && <LoaderCircle size={20} className="animate-spin" />}
                Connect Wallet
              </ThemeButton>
            </div>
          </div>
        </div>
      </CredenzaContent>
    </Credenza>
  )
}

const AllChains = [
  Chain.Avalanche,
  Chain.Base,
  Chain.BinanceSmartChain,
  Chain.Bitcoin,
  Chain.BitcoinCash,
  Chain.Cosmos,
  Chain.Dogecoin,
  Chain.Ethereum,
  Chain.Litecoin,
  Chain.Kujira,
  Chain.THORChain
]

const WALLETS: WalletProps[] = [
  {
    key: 'metamask',
    label: 'MetaMask',
    type: WalletType.browser,
    option: WalletOption.METAMASK,
    link: 'https://metamask.io',
    supportedChains: supportedChains[WalletOption.METAMASK]
  },
  {
    key: 'vultisig',
    type: WalletType.browser,
    label: 'Vultisig',
    option: WalletOption.VULTISIG,
    link: 'https://vultisig.com',
    supportedChains: supportedChains[WalletOption.VULTISIG]
  },
  {
    key: 'phantom',
    type: WalletType.browser,
    label: 'Phantom',
    option: WalletOption.PHANTOM,
    link: 'https://phantom.app',
    supportedChains: supportedChains[WalletOption.PHANTOM]
  },
  {
    key: 'ctrl',
    type: WalletType.browser,
    label: 'Ctrl',
    option: WalletOption.CTRL,
    link: 'https://ctrl.xyz',
    supportedChains: supportedChains[WalletOption.CTRL]
  },
  {
    key: 'keplr',
    type: WalletType.browser,
    label: 'Keplr',
    option: WalletOption.KEPLR,
    link: 'https://www.keplr.app',
    supportedChains: supportedChains[WalletOption.KEPLR]
  },
  {
    key: 'okx',
    type: WalletType.browser,
    label: 'OKX',
    option: WalletOption.OKX,
    link: 'https://web3.okx.com',
    supportedChains: supportedChains[WalletOption.OKX]
  },
  {
    key: 'tronlink',
    type: WalletType.browser,
    label: 'TronLink',
    option: WalletOption.TRONLINK,
    link: 'https://www.tronlink.org',
    supportedChains: supportedChains[WalletOption.TRONLINK]
  },
  {
    key: 'ledger',
    type: WalletType.hardware,
    label: 'Ledger',
    option: WalletOption.LEDGER,
    link: 'https://www.ledger.com',
    supportedChains: supportedChains[WalletOption.LEDGER]
  }
]
