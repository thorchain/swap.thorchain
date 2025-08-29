import Image from 'next/image'
import { useState } from 'react'
import { AccountProvider, Network } from 'rujira.js'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Provider } from '@/wallets'
import { cn } from '@/lib/utils'

export interface WalletProps<T> {
  key: string
  label: string
  isHardware?: boolean
  provider: T
}

interface WalletConnectDialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: AccountProvider<T>
  wallets: WalletProps<T>[]
  connectedProviders: Provider[]
}

export const WalletConnectDialog = <T,>({
  open,
  onOpenChange,
  provider,
  wallets,
  connectedProviders
}: WalletConnectDialogProps<T>) => {
  const { connect, isAvaialable } = provider
  const [chosen, setChosen] = useState<Map<T, boolean>>(new Map())
  const [connecting, setConnecting] = useState(false)

  const chosenSize = Array.from(chosen.values()).filter(i => i).length
  const networks = Object.values(Network)

  const installedWallets = wallets.filter(w => isAvaialable(w.provider))
  const hardwareWallets = wallets.filter(w => w.isHardware)
  const otherWallets = wallets.filter(w => !isAvaialable(w.provider) && !w.isHardware)

  const handleConnect = async () => {
    const chosenList = Array.from(chosen.entries()).filter(([, value]) => value)

    setConnecting(true)

    Promise.all(chosenList.map(([provider]) => connect(provider)))
      .then(() => {
        console.log('connected')
      })
      .finally(() => {
        setChosen(new Map())
        setConnecting(false)
      })
  }

  const walletItem = (wallet: WalletProps<T>) => {
    const isChosen = chosen.get(wallet.provider)
    const isConnected = connectedProviders.find(i => i === wallet.provider)

    return (
      <div
        key={wallet.key}
        className={cn('flex cursor-pointer items-center space-x-3 rounded-lg border-1 border-transparent p-3', {
          'border-emerald-500': isChosen,
          'bg-emerald-500/10': isConnected
        })}
        onClick={() => {
          if (isConnected) return
          setChosen(prevChosen => {
            const newChosen = new Map(prevChosen)
            newChosen.set(wallet.provider, !isChosen)
            return newChosen
          })
        }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600">
          <span className="text-lg text-white">👻</span>
        </div>
        <div className="flex-1">
          <div className="font-medium text-white">{wallet.label}</div>
          <div className="text-sm text-gray-400">{isConnected ? 'Connected' : 'Disconnected'}</div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 w-full max-w-3xl min-w-2xl overflow-hidden border-gray-700 bg-gray-900 p-0 text-white">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-semibold text-white">Connect Wallet</DialogTitle>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-8 px-6 pb-6">
          <div className="space-y-8 border-r-1 pe-3">
            <div className="h-full max-h-[400px] overflow-y-auto">
              <div>
                <h3 className="mb-4 text-sm font-medium text-gray-400">Installed in your browser</h3>
                <div className="space-y-3">{installedWallets.map(wallet => walletItem(wallet))}</div>
              </div>

              <div>
                <h3 className="mb-4 text-sm font-medium text-gray-400">Hardware and Instant Wallets</h3>
                {hardwareWallets.map(wallet => walletItem(wallet))}
              </div>

              <div>
                <h3 className="mb-4 text-sm font-medium text-gray-400">Other browser wallets</h3>
                {otherWallets.map(wallet => walletItem(wallet))}
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between">
            <div>
              <h3 className="mb-4 text-sm font-medium text-gray-400">Supported Networks</h3>
              <div className="grid grid-cols-4 gap-3">
                {networks.map(network => (
                  <div key={network} className="flex h-12 w-12 items-center justify-center rounded-xl">
                    <Image src={`/networks/${network}.png`} alt="" width="32" height="32" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                className="border-0 bg-gradient-to-r from-green-400 to-blue-500 text-white hover:from-green-500 hover:to-blue-600"
                disabled={chosenSize < 1 || connecting}
                onClick={() => handleConnect()}
              >
                Connect {chosenSize || ''} Wallet
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
