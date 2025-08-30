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

  const networks = Object.values(Network).filter(i => i !== Network.Terra && i !== Network.Terra2)
  const chosenSize = Array.from(chosen.values()).filter(i => i).length

  const handleConnect = async () => {
    const chosenList = Array.from(chosen.entries()).filter(([, value]) => value)
    if (!chosenList.length) return

    setConnecting(true)

    withTimeout(Promise.all(chosenList.map(([provider]) => connect(provider))), 20_000)
      .then(() => {
        console.log('connected')
      })
      .catch(err => {
        console.log(err.message)
      })
      .finally(() => {
        setChosen(new Map())
        setConnecting(false)
      })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-deep-black mx-4 w-full max-w-3xl min-w-2xl overflow-hidden p-0">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-semibold text-white">Connect Wallet</DialogTitle>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-8 px-6 pb-6">
          <div className="border-r-1 pe-3">
            <div className="text-gray mb-3 text-base font-semibold">Wallets</div>
            <div className="h-full max-h-[400px] overflow-y-auto">
              <div className="space-y-1">
                {wallets.map(wallet => {
                  const isChosen = chosen.get(wallet.provider)
                  const isConnected = connectedProviders.find(i => i === wallet.provider)
                  const isInstalled = isAvaialable(wallet.provider)

                  return (
                    <div
                      key={wallet.key}
                      className={cn(
                        'flex cursor-pointer items-center space-x-3 rounded-lg border-1 border-transparent p-3',
                        {
                          'border-runes-blue': isChosen,
                          'bg-emerald-500/10': isConnected
                        }
                      )}
                      onClick={() => {
                        if (isConnected) return
                        setChosen(prevChosen => {
                          const newChosen = new Map(prevChosen)
                          newChosen.set(wallet.provider, !isChosen)
                          return newChosen
                        })
                      }}
                    >
                      <Image src={`/wallets/${wallet.provider}.png`} alt="" width="32" height="32" />
                      <div className="flex-1">
                        <div className="font-medium text-white">{wallet.label}</div>
                        <div className="text-sm text-gray-400">
                          {isInstalled ? (isConnected ? 'Connected' : 'Disconnected') : 'Install'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between">
            <div>
              <h3 className="text-gray mb-3 text-base font-semibold">Supported Networks</h3>
              <div className="grid grid-cols-4 gap-3">
                {networks.map(network => (
                  <div key={network} className="flex h-12 w-12 items-center justify-center rounded-xl">
                    <Image src={`/networks/${network}.png`} alt={network} width="32" height="32" />
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('Connection timeout')), ms)
    promise
      .then(res => {
        clearTimeout(id)
        resolve(res)
      })
      .catch(err => {
        clearTimeout(id)
        reject(err)
      })
  })
}
