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

const DERIVATION_PATHS = {
  native_segwit: {
    title: 'Native Segwit',
    pathTitle: "m/84'/0'/0'/0/{index}",
    path: (index: number) => [84, 0, 0, 0, index]
  },
  native_segwit_middle: {
    title: 'Native Segwit',
    pathTitle: "m/84'/0'/{index}'/0/0",
    path: (index: number) => [84, 0, index, 0, 0]
  },
  taproot: {
    title: 'Taproot',
    pathTitle: "m/86'/0'/0'/0/{index}",
    path: (index: number) => [86, 0, 0, 0, index]
  },
  metamask: {
    title: 'Metamask',
    pathTitle: "m/44'/60'/0'/0/{index}",
    path: (index: number) => [44, 60, 0, 0, index]
  },
  ledger_live: {
    title: 'Ledger Live',
    pathTitle: "m/44'/60'/{index}'/0/0",
    path: (index: number) => [44, 60, index, 0, 0]
  },
  legacy: {
    title: 'Legacy',
    pathTitle: "m/44'/60'/0'/{index}",
    path: (index: number) => [44, 60, 0, index]
  },
  thorchain: {
    title: 'Default',
    pathTitle: "m/44'/931'/0'/0/{index}",
    path: (index: number) => [44, 931, 0, 0, index]
  },
  // Litecoin (SLIP-44 coin type 2). Native segwit ⇒ ltc1… addresses.
  ltc_native_segwit: {
    title: 'Native Segwit',
    pathTitle: "m/84'/2'/0'/0/{index}",
    path: (index: number) => [84, 2, 0, 0, index]
  },
  ltc_legacy: {
    title: 'Legacy',
    pathTitle: "m/44'/2'/0'/0/{index}",
    path: (index: number) => [44, 2, 0, 0, index]
  },
  // Bitcoin Cash (SLIP-44 coin type 145). No segwit, legacy only.
  bch: {
    title: 'Default',
    pathTitle: "m/44'/145'/0'/0/{index}",
    path: (index: number) => [44, 145, 0, 0, index]
  },
  // Dogecoin (SLIP-44 coin type 3). No segwit, legacy only.
  doge: {
    title: 'Default',
    pathTitle: "m/44'/3'/0'/0/{index}",
    path: (index: number) => [44, 3, 0, 0, index]
  },
  // Dash (SLIP-44 coin type 5). No segwit, legacy only.
  dash: {
    title: 'Default',
    pathTitle: "m/44'/5'/0'/0/{index}",
    path: (index: number) => [44, 5, 0, 0, index]
  },
  // Zcash (SLIP-44 coin type 133). Transparent (t-addr) legacy.
  zcash: {
    title: 'Default',
    pathTitle: "m/44'/133'/0'/0/{index}",
    path: (index: number) => [44, 133, 0, 0, index]
  },
  // XRP Ledger (SLIP-44 coin type 144).
  ripple: {
    title: 'Default',
    pathTitle: "m/44'/144'/0'/0/{index}",
    path: (index: number) => [44, 144, 0, 0, index]
  },
  // TRON (SLIP-44 coin type 195).
  tron: {
    title: 'Default',
    pathTitle: "m/44'/195'/0'/0/{index}",
    path: (index: number) => [44, 195, 0, 0, index]
  },
  // Cosmos Hub (SLIP-44 coin type 118).
  cosmos: {
    title: 'Default',
    pathTitle: "m/44'/118'/0'/0/{index}",
    path: (index: number) => [44, 118, 0, 0, index]
  }
}

// EVM chains all use coin type 60, so they share one address and the same path
// presets. They're listed individually (rather than under one "EVM" entry) so a
// user who only knows Ethereum or Avalanche understands each is connectable.
const EVM_CHAINS = [Chain.Ethereum, Chain.Arbitrum, Chain.BinanceSmartChain, Chain.Base, Chain.Avalanche]
const EVM_PATHS: Array<keyof typeof DERIVATION_PATHS> = ['metamask', 'ledger_live', 'legacy']

// Every selectable chain needs at least one preset: the connect flow passes the
// chosen path down, and the SDK throws on an undefined path rather than falling
// back to a per-chain default.
const CHAIN_PATH_MAP: Record<string, Array<keyof typeof DERIVATION_PATHS>> = {
  ...Object.fromEntries(EVM_CHAINS.map(c => [c, EVM_PATHS])),
  [Chain.Bitcoin]: ['native_segwit', 'native_segwit_middle', 'taproot'],
  [Chain.Litecoin]: ['ltc_native_segwit', 'ltc_legacy'],
  [Chain.BitcoinCash]: ['bch'],
  [Chain.Dogecoin]: ['doge'],
  [Chain.Dash]: ['dash'],
  [Chain.Zcash]: ['zcash'],
  [Chain.Ripple]: ['ripple'],
  [Chain.Tron]: ['tron'],
  [Chain.Cosmos]: ['cosmos'],
  [Chain.THORChain]: ['thorchain']
}

export const Ledger = ({ wallet }: { wallet: WalletParams; onConnect: () => void }) => {
  const t = useTranslations('wallet')
  const chains = [
    ...EVM_CHAINS,
    Chain.Bitcoin,
    Chain.BitcoinCash,
    Chain.Litecoin,
    Chain.Dogecoin,
    Chain.Dash,
    Chain.Zcash,
    Chain.Ripple,
    Chain.Tron,
    Chain.Cosmos,
    Chain.THORChain
  ].sort((a, b) => chainLabel(a).localeCompare(chainLabel(b)))

  const accounts = useAccounts()
  const { connect } = useWallets()
  const [connecting, setConnecting] = useState(false)
  const [index, setIndex] = useState(0)
  const [selectedChain, setSelectedChain] = useState<string>(Chain.Ethereum)
  const [path, setPath] = useState<string | undefined>(Object.keys(DERIVATION_PATHS)[0])

  const connectedChains = useMemo(() => {
    return new Set(accounts.filter(a => a.provider === WalletOption.LEDGER).map(a => a.network))
  }, [accounts])

  const isChainConnected = (chain: string) => {
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
    setPath(pathOptions?.[0])
  }, [pathOptions])

  const handleConnect = async () => {
    const chains = [selectedChain]
    const derivationPath = path ? DERIVATION_PATHS[path as keyof typeof DERIVATION_PATHS].path(index) : undefined

    setConnecting(true)

    connect(WalletOption.LEDGER, chains as Chain[], { derivationPath })
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
                  <Image src={`/networks/${chain.toLowerCase()}.svg`} alt={chain} width="24" height="24" />
                  <div className="flex-1 text-sm">{chainLabel(chain as Chain)}</div>

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
            <Select value={path} onValueChange={setPath} disabled={connecting}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('selectAccountType')} />
              </SelectTrigger>
              <SelectContent position="item-aligned" className="text-txt-high-contrast placeholder:text-txt-med-contrast rounded-xl border-1">
                {pathOptions.map(item => {
                  const derivationPath = DERIVATION_PATHS[item as keyof typeof DERIVATION_PATHS]

                  return (
                    <SelectItem key={item} value={item}>
                      {derivationPath.title} <span className="text-txt-label-small">({derivationPath.pathTitle})</span>
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
        <span>
          {t('ledgerUnlockHint', {
            app: EVM_CHAINS.includes(selectedChain as Chain) ? 'Ethereum' : selectedChain ? chainLabel(selectedChain as Chain) : t('correspondingApp')
          })}
        </span>
      </div>

      <div className="flex p-4 md:justify-end md:px-8 md:pt-0 md:pb-8">
        <GenericButton colorType="3" size="large" className="w-full md:w-auto" disabled={connecting || !selectedChain || !pathOptions} onClick={() => handleConnect()}>
          {connecting && <LoaderCircle size={20} className="animate-spin" />}
          {t('connectNamed', { name: wallet.label })}
        </GenericButton>
      </div>
    </>
  )
}
