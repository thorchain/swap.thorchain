import { Chain, WalletOption } from '@tcswap/core'
import { toast } from 'sonner'
import { isWalletconnectDismissed, onWalletconnectDisconnect } from '@tcswap/wallets/walletconnect'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { readWalletLink, writeWalletLink } from '@/store/wallets-store-cookie'
import { getAccounts, getUSwap, syncBraveAccountWatch } from '@/lib/wallets'

export interface WalletAccount {
  address: string
  network: Chain
  provider: WalletOption
  derivationPath?: number[]
}

interface WalletState {
  accounts: WalletAccount[]
  selected?: WalletAccount
  connectedWallets: WalletOption[]
  hasHydrated: boolean
  externalWalletMode: boolean

  select: (account?: WalletAccount) => void
  // Resolves with the accounts connected, none when it failed (the error is toasted, as `describeError` words it).
  connect: (
    wallet: WalletOption,
    chains: Chain[],
    config?: any,
    describeError?: (error: unknown) => string | undefined
  ) => Promise<WalletAccount[]>
  disconnect: (wallet: WalletOption) => void
  setExternalWalletMode: (enabled: boolean) => void
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      accounts: [],
      connectedWallets: [],
      selected: undefined,
      hasHydrated: false,
      externalWalletMode: false,

      select: (account?: WalletAccount) => {
        set({ selected: account })
      },

      connect: async (wallet, chains, config, describeError) => {
        try {
          const newAccounts = await getAccounts(wallet, chains, config)
          if (!newAccounts.length) {
            throw new Error(`Failed to get addresses for ${wallet}`)
          }

          set(state => {
            const replacedChains = new Set(newAccounts.map(a => a.network))
            const filtered = state.accounts.filter(acc => acc.provider !== wallet || !replacedChains.has(acc.network))
            const accounts = [...filtered, ...newAccounts]

            return {
              accounts,
              connectedWallets: Array.from(new Set([...state.connectedWallets, wallet]))
            }
          })

          return newAccounts
        } catch (err: any) {
          if (!isWalletconnectDismissed(err)) toast.error(describeError?.(err) ?? err.message)
          return []
        }
      },

      setExternalWalletMode: (enabled: boolean) => {
        set({ externalWalletMode: enabled })
      },

      disconnect: (wallet: WalletOption) => {
        // Ends the wallet's session even on chains another wallet has since taken over, leaving those to it.
        getUSwap().disconnectWallet(wallet)

        set(state => {
          const accounts = state.accounts.filter(acc => acc.provider !== wallet)
          const wallets = state.connectedWallets.filter(w => w !== wallet)

          return {
            accounts,
            connectedWallets: wallets
          }
        })
      }
    }),
    {
      name: 'tc-wallet-store',
      version: 1,
      skipHydration: true, // Rehydrate on the client to avoid an import-cycle TDZ.
      partialize: state => ({
        selected: state.selected,
        externalWalletMode: state.externalWalletMode
      }),
      onRehydrateStorage: () => async (_state, error) => {
        if (error) console.log(error)

        const link = readWalletLink()
        if (link.length === 0) {
          useWalletStore.setState({ accounts: [], connectedWallets: [], selected: undefined, hasHydrated: true })
          return
        }

        // Chains with a stored derivation path reconnect one by one — hardware wallets share a single transport.
        const reconnect = async (w: (typeof link)[number]) => {
          const pathChains = w.chains.filter(chain => w.paths?.[chain])
          const defaultChains = w.chains.filter(chain => !w.paths?.[chain])

          const accounts: WalletAccount[] = []
          // WalletConnect reuses its stored session; with none left it stays disconnected rather than show a QR code.
          const config = w.provider === WalletOption.WALLETCONNECT ? { restoreOnly: true } : undefined
          if (defaultChains.length > 0) accounts.push(...(await getAccounts(w.provider, defaultChains, config)))
          for (const chain of pathChains) {
            accounts.push(...(await getAccounts(w.provider, [chain], { derivationPath: w.paths?.[chain] })))
          }

          return accounts
        }

        Promise.allSettled(link.map(reconnect))
          .then(res => {
            const rehydrated = res
              .reduce((a: WalletAccount[], v) => (v.status === 'fulfilled' ? [...v.value, ...a] : a), [])
              .filter(isInCore)

            // Accounts connected while rehydration was in flight win.
            useWalletStore.setState(state => {
              const connected = new Set(state.accounts.map(a => `${a.provider}:${a.network}`))
              const accounts = [...state.accounts, ...rehydrated.filter(a => !connected.has(`${a.provider}:${a.network}`))]

              return {
                accounts,
                connectedWallets: Array.from(new Set(accounts.map(w => w.provider)))
              }
            })
          })
          .finally(() => useWalletStore.setState({ hasHydrated: true }))
      }
    }
  )
)

// The phone ended a WalletConnect session (or it expired): its chains are no longer connected. Core decides
// what is left, as the store's accounts may not be in yet (rehydration, a connect in flight).
onWalletconnectDisconnect(chains => {
  getUSwap().disconnectWallet(WalletOption.WALLETCONNECT, chains)

  useWalletStore.setState(state => {
    const accounts = state.accounts.filter(a => a.provider !== WalletOption.WALLETCONNECT || isInCore(a))
    return { accounts, connectedWallets: Array.from(new Set(accounts.map(a => a.provider))) }
  })
})

// Whether core still holds the account's wallet; a WalletConnect chain the phone ended is dropped from it.
function isInCore(account: WalletAccount): boolean {
  return !!getUSwap().getWallet(account.provider, account.network)
}

// Mirror connected providers/chains to the shared cookie when they change.
useWalletStore.subscribe(state => {
  syncBraveAccountWatch(state.accounts)
  if (!state.hasHydrated) return
  writeWalletLink(state.accounts)
})
