import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Chain, WalletOption } from '@tcswap/core'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { GenericButton } from '@/components/generic-button'
import { Credenza, CredenzaContent, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { ScrollArea } from '@/components/ui/scroll-area'
import { BrowserWallet } from '@/components/connect-wallet/browser-wallet'
import { ALL_CHAINS, chainLabel, COMING_SOON_CHAINS, isWalletAvailable, WalletParams, WALLETS, WalletType } from '@/components/connect-wallet/config'
import { Keystore } from '@/components/connect-wallet/keystore/keystore'
import { Ledger } from '@/components/connect-wallet/ledger'
import { Trezor } from '@/components/connect-wallet/trezor'
import { WalletIcon } from '@/components/wallet-icon'
import { Icon } from '@/components/icons'
import { useHasHydrated, useWallets } from '@/hooks/use-wallets'
import { cn } from '@/lib/utils'
import { preloadWalletConnect, walletConnectEnabled } from '@/lib/wallets'

interface ConnectWalletProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  chain?: Chain
}

export const ConnectWallet = ({ isOpen, onOpenChange, chain }: ConnectWalletProps) => {
  const t = useTranslations('wallet')
  const [selectedWallet, setSelectedWallet] = useState<WalletParams | undefined>(undefined)
  const [selectedChain, setSelectedChain] = useState<Chain | undefined>(chain)
  const { connectedWallets, connect, disconnect } = useWallets()
  const isHydrated = useHasHydrated()
  const connectingOath = useRef(false)

  const connectOath = async (wallet: WalletParams, replace = false) => {
    if (connectingOath.current || !isHydrated) return
    connectingOath.current = true
    if (replace) disconnect(WalletOption.WALLETCONNECT)
    // Close the selector so it cannot block the SDK's QR modal or iOS handoff.
    onOpenChange(false)
    const requested = selectedChain ? [selectedChain] : wallet.supportedChains
    try {
      const accounts = await connect(WalletOption.WALLETCONNECT, requested, { walletKey: 'oath' }, () => t('oathConnectionFailed'))
      const missing = accounts.length ? requested.filter(chain => !accounts.some(account => account.network === chain)) : []
      if (missing.length) toast.warning(t('chainsNotConnected', { name: wallet.label, chains: missing.map(chainLabel).join(', ') }))
    } finally {
      connectingOath.current = false
    }
  }

  useEffect(() => {
    if (isOpen && walletConnectEnabled()) preloadWalletConnect()
  }, [isOpen])

  const chains = useMemo(
    () =>
      [...ALL_CHAINS, ...COMING_SOON_CHAINS].sort((a, b) => {
        return chainLabel(a)?.localeCompare(chainLabel(b))
      }),
    []
  )

  const wallets = useMemo(() => {
    const installed: WalletParams[] = []
    const others: WalletParams[] = []

    WALLETS.forEach(wallet => {
      if (isWalletAvailable(wallet.option)) {
        installed.push(wallet)
      } else {
        others.push(wallet)
      }
    })

    const sortByLabel = (a: WalletParams, b: WalletParams) => a.label.localeCompare(b.label)

    installed.sort(sortByLabel)
    others.sort(sortByLabel)

    return [...installed, ...others]
  }, [])

  const onSelectWallet = (wallet: WalletParams) => {
    if (wallet.key === 'oath' && !connectedWallets.includes(WalletOption.WALLETCONNECT)) {
      void connectOath(wallet)
      return
    }
    setSelectedWallet(prev => (prev === wallet ? undefined : wallet))
    setSelectedChain(undefined)
  }

  const onSelectChain = (chain: Chain) => {
    setSelectedChain(prev => (prev === chain ? undefined : chain))
  }

  const isWalletHighlighted = (wallet: WalletParams) => !selectedChain || wallet.supportedChains.includes(selectedChain)

  const walletList = (wallets: WalletParams[]) => {
    return wallets.map((wallet, index) => {
      const isOath = wallet.key === 'oath'
      const isConnected = !isOath && connectedWallets.includes(wallet.option)
      const isInstalled = isWalletAvailable(wallet.option)
      const isSelected = wallet === selectedWallet
      const isHighlighted = isWalletHighlighted(wallet)
      const isClickable =
        isInstalled &&
        isHighlighted &&
        (!isOath || isHydrated) &&
        (!isConnected || wallet.option === WalletOption.LEDGER || wallet.option === WalletOption.TREZOR)

      return (
        <div
          key={wallet.key}
          role="button"
          tabIndex={isClickable ? 0 : -1}
          aria-disabled={!isClickable}
          aria-label={wallet.label}
          onKeyDown={event => {
            if (isClickable && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault()
              onSelectWallet(wallet)
            }
          }}
          className={cn('mb-1 flex items-center space-x-3 rounded-2xl border border-transparent p-3', {
            'border-border-btn-modal-hover': isSelected,
            'opacity-25': !isHighlighted,
            'hover:bg-sub-container-modal/50 cursor-pointer': isClickable,
            'mb-4 md:mb-8': index === wallets.length - 1
          })}
          onClick={() => {
            if (!isClickable) return
            onSelectWallet(wallet)
          }}
        >
          <WalletIcon walletKey={wallet.key} width={32} height={32} />
          <div className="flex-1">
            <div className="text-txt-high-contrast font-medium">{wallet.label}</div>
            <div className="text-xs">
              {isOath ? (
                <span>{t('oathMobile')}</span>
              ) : isInstalled ? (
                isConnected ? (
                  <span className="text-green-contrast">{t('connected')}</span>
                ) : (
                  <span>{t('disconnected')}</span>
                )
              ) : (
                <a href={wallet.link} className="text-jacob" rel="noopener noreferrer" target="_blank">
                  {t('install')}
                </a>
              )}
            </div>
          </div>
        </div>
      )
    })
  }

  const renderSelectedWallet = (wallet: WalletParams) => {
    const onConnect = () => {
      onOpenChange(false)
    }

    if (wallet.key === 'oath') {
      return (
        <div className="space-y-4 px-4 pb-4 md:px-8 md:pb-8">
          <p className="text-txt-label-small text-sm">{t('oathExistingSession')}</p>
          <GenericButton colorType="3" size="large" onClick={() => void connectOath(wallet, true)}>
            {t('oathReplaceSession')}
          </GenericButton>
        </div>
      )
    }

    if (wallet.type === WalletType.browser) {
      return <BrowserWallet key={wallet.key} wallet={wallet} chains={chains} onConnect={onConnect} />
    }

    if (wallet.key === 'ledger') {
      return <Ledger key={wallet.key} wallet={wallet} onConnect={onConnect} />
    }

    if (wallet.key === 'trezor') {
      return <Trezor key={wallet.key} wallet={wallet} onConnect={onConnect} />
    }

    if (wallet.key === 'keystore') {
      return <Keystore key={wallet.key} wallet={wallet} chains={chains} onConnect={onConnect} />
    }

    return null
  }

  return (
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="flex h-auto max-h-5/6 flex-col">
        <CredenzaHeader>
          <CredenzaTitle>{t('connectWallet')}</CredenzaTitle>
        </CredenzaHeader>

        <div className="flex min-h-0 flex-col md:flex-row">
          <ScrollArea
            className={cn('flex min-h-0 flex-1 md:mb-0 md:w-2/5 md:flex-none md:border-r md:pr-8 md:pl-8', {
              'hidden md:flex': selectedWallet
            })}
            classNameViewport="flex-1 h-auto"
          >
            <div className="mx-4 block gap-2 md:mx-0 md:block md:w-full">{walletList(wallets)}</div>
          </ScrollArea>

          {selectedWallet && (
            <div className="mb-2 flex cursor-pointer items-center gap-4 px-4 pb-4 md:hidden" onClick={() => setSelectedWallet(undefined)}>
              <Icon name="arrow-m-left" className="text-txt-label-small size-6" />
              <div className="flex gap-2">
                <WalletIcon walletKey={selectedWallet.key} width={20} height={20} />
                <span className="text-txt-label-small text-sm font-medium">{selectedWallet.label}</span>
              </div>
            </div>
          )}

          {selectedWallet ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">{renderSelectedWallet(selectedWallet)}</div>
          ) : (
            <div className="hidden flex-1 flex-col md:flex">
              <div className="text-txt-label-small mb-3 px-8 text-base font-semibold">{t('chains')}</div>

              <div className="hidden min-h-0 flex-1 md:flex">
                <ScrollArea className="flex px-8" classNameViewport="flex-1 h-auto">
                  <div
                    className="grid flex-1 grid-flow-col gap-2 pb-4 md:pb-8"
                    style={{
                      gridTemplateRows: `repeat(${Math.ceil(chains.length / 2)}, minmax(0, 1fr))`,
                      gridTemplateColumns: 'repeat(2, 1fr)'
                    }}
                  >
                    {chains.map(chain => {
                      const isSelected = selectedChain === chain
                      const isComingSoon = COMING_SOON_CHAINS.includes(chain)

                      return (
                        <div
                          key={chain}
                          className={cn('flex items-center gap-3 rounded-2xl border-1 border-transparent px-4 py-3', {
                            'border-border-btn-modal-hover': isSelected,
                            'hover:bg-sub-container-modal/50 cursor-pointer': !isComingSoon
                          })}
                          onClick={() => !isComingSoon && onSelectChain(chain as Chain)}
                        >
                          <Image src={`/networks/${chain.toLowerCase()}.svg`} alt={chain} width="24" height="24" />
                          <div className="text-sm">{chainLabel(chain)}</div>
                          {isComingSoon && (
                            <div className="text-gray border-gray rounded-full border px-1.5 text-[10px] font-semibold">{t('soon')}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </CredenzaContent>
    </Credenza>
  )
}
