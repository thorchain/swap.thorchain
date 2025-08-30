'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { Network, networkLabel } from 'rujira.js'
import { Asset } from '@/components/swap/asset'
import { usePools } from '@/hook/use-pools'
import { cn } from '@/lib/utils'

interface SelectCoinDialogProps {
  isOpen: boolean
  isInput: boolean
  onClose: () => void
  selected?: Asset
  onSelectAsset: (asset: Asset) => void
}

export function SwapSelectCoin({ isOpen, onClose, selected, onSelectAsset, isInput }: SelectCoinDialogProps) {
  const [selectedChain, setSelectedChain] = useState<Network>(Network.Bitcoin)
  const [searchQuery, setSearchQuery] = useState('')

  const { pools } = usePools()

  const chains: Map<Network, Asset[]> = new Map()
  const items = pools || []

  for (let i = 0; i < items.length; i++) {
    const asset = items[i]
    const list = chains.get(asset.chain)

    if (list) {
      list.push(asset)
    } else {
      chains.set(asset.chain, [asset])
    }
  }

  const networks = Array.from(chains.keys())
  const chainAssets = chains.get(selectedChain) || []
  const handleChainSelect = (chain: Network) => {
    setSelectedChain(chain)
  }

  const handleAssetSelect = (asset: Asset) => {
    onSelectAsset(asset)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-deep-black w-full max-w-3xl min-w-2xl gap-0 p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-2xl font-medium text-white">Select Coin</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <div className="w-1/2 border-r p-6 pt-0">
            <h3 className="mb-4 text-sm font-medium text-gray">Chains</h3>
            <div className="h-full max-h-[400px] space-y-1 overflow-y-auto">
              {networks.map((network, index) => (
                <button
                  key={index}
                  onClick={() => handleChainSelect(network)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 hover:bg-neutral-900 ${
                    selectedChain === network ? 'border-runes-blue' : 'border-transparent'
                  }`}
                >
                  <div className="flex h-8 w-8 items-center rounded-lg">
                    <Image src={`/networks/${network}.png`} alt="" width="32" height="32" />
                  </div>
                  <div className="flex h-8 w-full items-center text-sm font-bold text-white">
                    {networkLabel(network)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="w-1/2 p-6 pt-0">
            <h3 className="mb-4 text-sm font-medium text-gray">Assets</h3>

            <div className="relative mb-4">
              <Search className="absolute top-1/2 left-3 -translate-y-1/2 transform text-gray" size={18} />
              <Input
                placeholder="Search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="border-gray-700 bg-gray-800 pl-10 text-white placeholder-gray-400"
              />
            </div>

            <div className="h-full max-h-[400px] space-y-1 overflow-y-auto">
              {chainAssets.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleAssetSelect(item)}
                  className="flex w-full items-center justify-between border border-transparent p-3 transition-all hover:bg-neutral-900"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 rounded-full bg-orange-500"></div>
                    <div className="text-left">
                      <div className="text-leah font-semibold">{item.metadata.symbol}</div>
                      <div className="text-gray text-sm">{networkLabel(item.chain)}</div>
                    </div>
                  </div>
                  {item.asset === selected?.asset && (
                    <div
                      className={cn('rounded-full border px-2 py-1 text-xs font-medium', {
                        'border-green-500': isInput,
                        'text-green-400': isInput,
                        'border-yellow-500': !isInput,
                        'text-yellow-400': !isInput
                      })}
                    >
                      {isInput ? 'INPUT' : 'OUTPUT'}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
