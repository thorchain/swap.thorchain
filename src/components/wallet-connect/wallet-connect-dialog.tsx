import Image from 'next/image'
import { useState } from 'react'
import { AccountProvider, Network, networkLabel } from 'rujira.js'
import { Credenza, CredenzaContent, CredenzaFooter, CredenzaHeader, CredenzaTitle } from '@/components/ui/credenza'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Provider } from '@/wallets'
import { usePools } from '@/hooks/use-pools'
import { cn } from '@/lib/utils'

export interface WalletProps<T> {
  key: string
  label: string
  provider: T
  link: string
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
  const { pools } = usePools()

  const networks: Network[] = [...new Set((pools || []).map(p => p.chain))]
  const chosenSize = Array.from(chosen.values()).filter(i => i).length

  const handleConnect = async () => {
    const chosenList = Array.from(chosen.entries()).filter(([, value]) => value)
    if (!chosenList.length) return

    setConnecting(true)

    withTimeout(Promise.all(chosenList.map(([provider]) => connect(provider))), 20_000)
      .then(() => {
        onOpenChange(false)
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
    <Credenza open={open} onOpenChange={onOpenChange}>
      <CredenzaContent className="bg-lawrence min-h-1/2 w-full p-6 md:min-w-2xl md:p-12">
        <CredenzaHeader className="flex items-start">
          <CredenzaTitle className="text-base font-semibold text-white md:text-2xl">Connect Wallet</CredenzaTitle>
        </CredenzaHeader>

        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-5">
          <div className="col-span-2 border-0 pe-3 md:border-r">
            <div className="text-gray mb-3 hidden text-base font-semibold md:block">Wallets</div>
            <ScrollArea className="h-full max-h-[40vh] md:max-h-[60vh]">
              <div className="space-y-1">
                {wallets.map(wallet => {
                  const isChosen = chosen.get(wallet.provider)
                  const isConnected = connectedProviders.find(i => i === wallet.provider)
                  const isInstalled = isAvaialable(wallet.provider)

                  return (
                    <div
                      key={wallet.key}
                      className={cn('flex items-center space-x-3 rounded-lg border-1 border-transparent p-3', {
                        'border-runes-blue': isChosen,
                        'bg-emerald-500/10': isConnected,
                        'cursor-pointer': isInstalled
                      })}
                      onClick={() => {
                        if (isConnected || !isInstalled) return
                        setChosen(prevChosen => {
                          const newChosen = new Map(prevChosen)
                          newChosen.set(wallet.provider, !isChosen)
                          return newChosen
                        })
                      }}
                    >
                      <Image src={`/wallets/${wallet.key}.svg`} alt="" width="32" height="32" />
                      <div className="flex-1">
                        <div className="font-medium text-white">{wallet.label}</div>
                        <div className="text-xs">
                          {isInstalled ? (
                            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                          ) : (
                            <a href={wallet.link} className="text-jacob" rel="noopener noreferrer" target="_blank">
                              Install
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
          <div className="col-span-3 hidden md:block">
            <h3 className="text-gray mb-3 text-base font-semibold">Supported Networks</h3>
            <div className="grid grid-cols-2 gap-2">
              {networks.map(network => (
                <div key={network} className="flex items-center gap-3 p-2">
                  <Image src={`/networks/${network.toLowerCase()}.svg`} alt={network} width="24" height="24" />
                  <div className="text-sm">{networkLabel(network)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <CredenzaFooter>
          <div className="flex justify-end">
            <Button
              className="border-0 bg-gradient-to-r from-green-400 to-blue-500 text-white hover:from-green-500 hover:to-blue-600"
              disabled={chosenSize < 1 || connecting}
              onClick={() => handleConnect()}
            >
              Connect {chosenSize || ''} Wallet
            </Button>
          </div>
        </CredenzaFooter>
      </CredenzaContent>
    </Credenza>
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
