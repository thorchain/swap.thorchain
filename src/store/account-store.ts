import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Account, AccountProvider, disconnect, getAccounts, isAvaialable, onChange, Provider } from '@/wallets'
import { useSwapStore } from '@/store/swap-store'
import { toast } from 'sonner'

export interface WalletContext {
  account: Account
  context?: any
}

interface AccountsState extends AccountProvider {
  wallets: WalletContext[]
  providers: Provider[]
  resolveSource: () => void
  selectedWallet?: WalletContext
}

export const useAccountStore = create<AccountsState>()(
  persist(
    (set, get) => ({
      wallets: [],
      accounts: [],
      selected: undefined,
      selectedWallet: undefined,
      providers: [],

      select: account => {
        if (!account) {
          return set({ selected: undefined })
        }

        set(state => {
          const found = state.wallets.find(
            a =>
              a.account.provider === account.provider &&
              a.account.network === account.network &&
              (!account.address || a.account.address === account.address)
          )

          return { selected: found?.account, selectedWallet: found }
        })
      },

      connect: async provider => {
        try {
          const accs = await getAccounts(provider)
          if (!accs.length) throw new Error(`No accounts found on ${provider}`)
          const { assetFrom, resolveDestination } = useSwapStore.getState()

          set(state => {
            const filtered = state.wallets.filter(x => x.account.provider !== provider)
            const toSelect = accs.find(x => x.account.network === assetFrom?.chain)
            const wallets = [...filtered, ...accs]

            return {
              wallets,
              accounts: wallets.map(a => a.account),
              selected: toSelect?.account,
              selectedWallet: toSelect,
              providers: Array.from(new Set([...state.providers, provider]))
            }
          })

          resolveDestination()
        } catch (err: any) {
          toast.error(err.message)
        }
      },

      disconnect: provider => {
        disconnect(provider)
        const { assetFrom, resolveDestination } = useSwapStore.getState()

        set(state => {
          const wallets = state.wallets.filter(x => x.account.provider !== provider)
          const accounts = wallets.map(a => a.account)
          const toSelect = wallets.find(x => x.account.network === assetFrom?.chain)

          return {
            wallets: wallets,
            accounts,
            selected: toSelect?.account,
            selectedWallet: toSelect,
            providers: state.providers.filter(p => p !== provider)
          }
        })

        resolveDestination()
      },

      disconnectAll: () => {
        get().wallets.forEach(a => disconnect(a.account.provider))
        set({
          wallets: [],
          accounts: [],
          selected: undefined,
          selectedWallet: undefined,
          providers: []
        })

        useSwapStore.getState().resolveDestination()
      },

      resolveSource: async () => {
        const { wallets } = get()
        const { assetFrom } = useSwapStore.getState()

        const wallet = wallets?.find(w => w.account.network === assetFrom?.chain)

        set({
          selected: wallet?.account,
          selectedWallet: wallet
        })
      },

      isAvaialable: provider => isAvaialable(provider)
    }),
    {
      name: `thorswap-accounts-${process.env.NEXT_PUBLIC_MODE}`,
      partialize: state => ({
        accounts: state.accounts,
        selected: state.selected,
        providers: state.providers
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          console.log(error)
          return
        }

        const { selected } = state

        Promise.allSettled(
          state.providers.map(p => {
            return getAccounts(p)
          })
        ).then(x => {
          const wallets = x.reduce((a: WalletContext[], v) => (v.status === 'fulfilled' ? [...v.value, ...a] : a), [])
          const accounts = wallets.map(a => a.account)

          const wallet = wallets.find(
            a =>
              a.account.provider === selected?.provider &&
              a.account.network === selected?.network &&
              (!selected.address || a.account.address === selected.address)
          )
          useAccountStore.setState({
            wallets,
            accounts,
            selected: wallet?.account,
            selectedWallet: wallet,
            providers: Array.from(new Set(accounts.map(w => w.provider)))
          })

          useSwapStore.getState().resolveDestination()
        })
      }
    }
  )
)

useAccountStore.subscribe((currState, prevState) => {
  const currProvider = currState.selected?.provider
  const prevProvider = prevState.selected?.provider

  if (!currProvider || (currProvider === prevProvider && prevState.wallets.length)) return

  onChange(currProvider, async () => {
    getAccounts(currProvider).then(accs => {
      const { assetFrom } = useSwapStore.getState()

      useAccountStore.setState(state => {
        const filtered = state.wallets.filter(x => x.account.provider !== currProvider)
        const wallets = [...filtered, ...accs]
        const toSelect = accs.find(x => x.account.network === assetFrom?.chain)

        return {
          wallets,
          accounts: wallets.map(a => a.account),
          selected: toSelect?.account,
          selectedWallet: toSelect,
          providers: Array.from(new Set([...state.providers, currProvider]))
        }
      })

      useSwapStore.getState().resolveDestination()
    })
  })
})

export const useConnectedProviders = () => useAccountStore(state => state.providers)
export const useDisconnect = () => useAccountStore(state => state.disconnect)
