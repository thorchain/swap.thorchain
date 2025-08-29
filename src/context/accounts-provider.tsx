'use client'

import { createContext, FC, PropsWithChildren, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Network } from 'rujira.js'
import { Account, AccountProvider, Provider, wallets } from '@/wallets'

const {
  getAccounts,
  addProvider,
  clearProviders,
  clearSelected,
  loadProviders,
  loadSelected,
  removeProvider,
  saveSelected,
  onChange,
  isAvaialable
} = wallets

const ERROR = () => {
  throw new Error('AccountProvider Context not defined')
}

interface WalletContext {
  account: Account
  context: any
}

interface AccountContext extends AccountProvider {
  context?: any
  wallets: WalletContext[]
}

const Context = createContext<AccountContext>({
  wallets: [],
  accounts: undefined,
  select: ERROR,
  connect: ERROR,
  disconnect: ERROR,
  disconnectAll: ERROR,
  isAvaialable: ERROR
})

// Currently we only support 1-1 relationship between providers and connected account(s)
// If for example a user has multiple accounts connected on a Metamask wallet, the context
// will provide just the one that is currently selected
// This is relatively easily extended to allow a user to connect to a provider multiple
// times, registering each account/address and allowing the UI to visually represent
// (or auto-fix) a mis-match between UI-selected account and provider-selected account
const storedSelected = loadSelected()
// These are the providers that have been previously connected, and so we should attempt to re-connect
// on a page refresh, where possible without triggering annoying modal prompts from the wallets
// If a connection is refused, it should be removed from the list of stored providers
const connectedProviders: Provider[] = loadProviders()

export const AccountsProvider: FC<PropsWithChildren> = ({ children }) => {
  const [provider, setProvider] = useState<Provider | undefined>(storedSelected?.provider)
  const [network, setNetwork] = useState<Network | undefined>(storedSelected?.network)

  const [address, setAddress] = useState<string | undefined>(storedSelected?.address)

  const [accounts, setAccounts] = useState<WalletContext[]>()

  useEffect(() => {
    Promise.allSettled(
      connectedProviders.map(x =>
        getAccounts(x).catch(err => {
          // Don't keep trying
          removeProvider(x)
          throw err
        })
      )
    ).then(x =>
      setAccounts(x.reduce((a: WalletContext[], v) => (v.status === 'fulfilled' ? [...v.value, ...a] : a), []))
    )
  }, [])

  const selected = accounts?.find(
    a =>
      a.account.network === network &&
      a.account.provider === provider &&
      (address ? a.account.address === address : true)
  )

  useEffect(() => {
    if (!selected) return
    return onChange(selected?.account.provider, () => {
      getAccounts(selected?.account.provider).then(x => {
        if (!x.length) return
        setAccounts((prev = []) => [...prev.filter(x => x.account.provider !== provider), ...x])
      })
    })
  }, [provider, selected])

  const connect = async (provider: Provider) => {
    try {
      const x = await getAccounts(provider)
      if (!x.length) throw new Error(`No accounts found on ${provider}`)
      const toSelect = x.find(x => x.account.network === Network.Thorchain) || x[0]
      addProvider(provider)
      if (toSelect) {
        saveSelected(provider, toSelect.account.network)
        setNetwork(toSelect.account.network)
      }
      setProvider(provider)
      setAccounts((prev = []) => [...prev.filter(x => x.account.provider !== provider), ...x])
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const select = (
    account: {
      provider: Provider
      network: Network
      address?: string
    } | null
  ) => {
    if (!account) {
      clearSelected()
      setProvider(undefined)
      setNetwork(undefined)
      setAddress(undefined)
      return
    }

    // Some wallets will return multiple addresses for a single Network, eg
    // Metamask with multiple accounts. We need to be able to select a specific address
    // Other wallets, eg Keplr, will only return the currently selected wallet,
    // so we need to only use the address as a "preference" rather than a required match

    switch (account.provider) {
      case 'Metamask':
        saveSelected(account.provider, account.network, account.address)
        setProvider(account.provider)
        setNetwork(account.network)
        setAddress(account.address)
        break
      default:
        saveSelected(account.provider, account.network)
        setProvider(account.provider)
        setNetwork(account.network)
        setAddress(undefined)
    }
  }

  const disconnect = (p: Provider) => {
    wallets.disconnect(p)
    removeProvider(p)
    setAccounts((prev = []) => {
      const filtered = prev.filter(x => x.account.provider !== p)
      const selected = filtered[0]
      if (selected) {
        saveSelected(selected.account.provider, selected.account.network, selected.account.address)
      }
      return filtered
    })
  }

  const disconnectAll = () => {
    accounts?.map(a => wallets.disconnect(a.account.provider))
    clearProviders()
    clearSelected()
    setAccounts([])
  }

  return (
    <Context.Provider
      value={{
        wallets: accounts || [],
        accounts: accounts?.map(a => a.account),
        selected: selected?.account,
        context: selected?.context,
        select,
        connect,
        disconnect,
        disconnectAll,
        isAvaialable
      }}
    >
      {children}
    </Context.Provider>
  )
}

export const useAccounts = (): AccountContext => useContext(Context)
