import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { Chain, WalletOption } from '@tcswap/core'
import { CircleCheckBig, Info, LoaderCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { chainLabel, WalletParams } from '@/components/connect-wallet/config'
import { GenericButton } from '@/components/generic-button'
import { useAccounts, useWallets } from '@/hooks/use-wallets'
import { cn } from '@/lib/utils'

type PathPreset = {
  title: string
  pathTitle: string
  path: (index: number) => number[]
}

// Trezor derives an address by BIP-44 path. The first element selects the UTXO
// script type in the SDK (84 → native segwit, 49 → p2sh-segwit, 44 → legacy),
// the second is the coin type — so every coin needs its own presets (unlike
// Ledger, whose UI reuses one BTC-centric map and relies on SDK defaults).
// Trezor has no taproot signer here, so taproot is intentionally omitted.
const CHAIN_PATH_MAP: Record<string, PathPreset[]> = {
  EVM: [{ title: 'Default', pathTitle: "m/44'/60'/0'/0/{index}", path: index => [44, 60, 0, 0, index] }],
  [Chain.Bitcoin]: [
    { title: 'Native SegWit', pathTitle: "m/84'/0'/0'/0/{index}", path: index => [84, 0, 0, 0, index] },
    { title: 'SegWit', pathTitle: "m/49'/0'/0'/0/{index}", path: index => [49, 0, 0, 0, index] },
    { title: 'Legacy', pathTitle: "m/44'/0'/0'/0/{index}", path: index => [44, 0, 0, 0, index] }
  ],
  [Chain.Litecoin]: [
    { title: 'Native SegWit', pathTitle: "m/84'/2'/0'/0/{index}", path: index => [84, 2, 0, 0, index] },
    { title: 'SegWit', pathTitle: "m/49'/2'/0'/0/{index}", path: index => [49, 2, 0, 0, index] },
    { title: 'Legacy', pathTitle: "m/44'/2'/0'/0/{index}", path: index => [44, 2, 0, 0, index] }
  ],
  [Chain.BitcoinCash]: [{ title: 'Default', pathTitle: "m/44'/145'/0'/0/{index}", path: index => [44, 145, 0, 0, index] }],
  [Chain.Dogecoin]: [{ title: 'Default', pathTitle: "m/44'/3'/0'/0/{index}", path: index => [44, 3, 0, 0, index] }],
  [Chain.Dash]: [{ title: 'Default', pathTitle: "m/44'/5'/0'/0/{index}", path: index => [44, 5, 0, 0, index] }],
  [Chain.Zcash]: [{ title: 'Default', pathTitle: "m/44'/133'/0'/0/{index}", path: index => [44, 133, 0, 0, index] }]
}

export const Trezor = ({ wallet }: { wallet: WalletParams; onConnect: () => void }) => {
  const t = useTranslations('wallet')
  const evmChains = [Chain.Ethereum, Chain.BinanceSmartChain, Chain.Base, Chain.Avalanche]
  const chains = ['EVM', Chain.Bitcoin, Chain.BitcoinCash, Chain.Litecoin, Chain.Dogecoin, Chain.Dash, Chain.Zcash]

  const accounts = useAccounts()
  const { connect } = useWallets()
  const [connecting, setConnecting] = useState(false)
  const [index, setIndex] = useState(0)
  const [selectedChain, setSelectedChain] = useState<string>('EVM')
  const [pathKey, setPathKey] = useState(0)

  const connectedChains = useMemo(() => {
    return new Set(accounts.filter(a => a.provider === WalletOption.TREZOR).map(a => a.network))
  }, [accounts])

  const isChainConnected = (chain: string) => {
    if (chain === 'EVM') return evmChains.every(c => connectedChains.has(c))
    return connectedChains.has(chain as Chain)
  }

  useEffect(() => {
    if (isChainConnected(selectedChain)) {
      const next = chains.find(c => !isChainConnected(c))
      setSelectedChain(next ?? '')
    }
  }, [connectedChains])

  const pathOptions = useMemo(() => {
    return CHAIN_PATH_MAP[selectedChain] ?? null
  }, [selectedChain])

  useEffect(() => {
    setPathKey(0)
  }, [pathOptions])

  const handleConnect = async () => {
    const chains = selectedChain === 'EVM' ? evmChains : [selectedChain]
    const derivationPath = pathOptions?.[pathKey]?.path(index)

    setConnecting(true)

    connect(WalletOption.TREZOR, chains as Chain[], { derivationPath })
      .catch(err => {
        console.log(err)
      })
      .finally(() => {
        setConnecting(false)
      })
  }

  return (
    <>
      <div className="text-txt-label-small mb-3 hidden px-8 text-base font-semibold md:block">{t('chains')}</div>

      <div className="relative flex min-h-0 flex-1">
        <ScrollArea className="flex-1 px-4 md:px-8">
          <div
            className="mb-4 grid flex-1 grid-flow-col gap-2"
            style={{
              gridTemplateRows: `repeat(${Math.ceil(chains.length / 2)}, minmax(0, 1fr))`,
              gridTemplateColumns: 'repeat(2, 1fr)'
            }}
          >
            {chains.map(chain => {
              const isSelected = selectedChain === chain
              const isConnected = isChainConnected(chain)

              return (
                <div
                  key={chain}
                  className={cn('flex items-center gap-3 rounded-2xl border border-transparent px-4 py-3', {
                    'border-border-btn-modal-hover': isSelected,
                    'hover:bg-sub-container-modal/50 cursor-pointer': !isConnected,
                    'opacity-60': isConnected
                  })}
                  onClick={() => {
                    if (isConnected) return
                    setSelectedChain(chain)
                  }}
                >
                  {chain === 'EVM' ? (
                    <>
                      <div className="flex -space-x-4">
                        {evmChains.map((chain, index) => {
                          return (
                            <Image
                              key={chain}
                              src={`/networks/${chain.toLowerCase()}.svg`}
                              alt={chain}
                              width="24"
                              height="24"
                              className="bg-body rounded-md"
                              style={{ zIndex: chains.length - index }}
                            />
                          )
                        })}
                      </div>
                      <div className="flex-1 text-sm">EVMs</div>
                    </>
                  ) : (
                    <>
                      <Image src={`/networks/${chain.toLowerCase()}.svg`} alt={chain} width="24" height="24" />
                      <div className="flex-1 text-sm">{chainLabel(chain as Chain)}</div>
                    </>
                  )}
                  {isConnected && <CircleCheckBig className="text-green-contrast size-5 shrink-0" />}
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <div className="from-modal pointer-events-none absolute inset-x-0 -bottom-px h-4 bg-linear-to-t to-transparent" />
      </div>

      {pathOptions && (
        <div className="mt-2 grid grid-cols-5 gap-3 px-8 md:mb-4">
          <div className="col-span-4">
            <div className="text-txt-label-small mb-2 font-semibold">{t('derivationPath')}</div>
            <Select value={String(pathKey)} onValueChange={v => setPathKey(Number(v))} disabled={connecting}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('selectAccountType')} />
              </SelectTrigger>
              <SelectContent position="item-aligned" className="text-txt-high-contrast placeholder:text-txt-med-contrast rounded-xl border-1">
                {pathOptions.map((option, i) => {
                  return (
                    <SelectItem key={option.pathTitle} value={String(i)}>
                      {option.title} <span className="text-txt-label-small">({option.pathTitle})</span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <div className="text-txt-label-small mb-2 font-semibold">{t('index')}</div>
            <Input placeholder="0" onChange={v => setIndex(parseInt(v.target.value, 10) || 0)} disabled={connecting} />
          </div>
        </div>
      )}

      <div className="text-txt-label-small flex items-start gap-2 px-8 pt-1 pb-3 text-xs">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>{t('trezorUnlockHint')}</span>
      </div>

      <div className="flex p-4 md:justify-end md:px-8 md:pt-0 md:pb-8">
        <GenericButton colorType="3" size="large" className="w-full md:w-auto" disabled={connecting || !selectedChain} onClick={() => handleConnect()}>
          {connecting && <LoaderCircle size={20} className="animate-spin" />}
          {t('connectNamed', { name: wallet.label })}
        </GenericButton>
      </div>
    </>
  )
}
