import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const jsx = require('react/jsx-runtime')
const Chain = Object.fromEntries(
  [
    'Arbitrum',
    'Avalanche',
    'Base',
    'BinanceSmartChain',
    'Bitcoin',
    'BitcoinCash',
    'Cosmos',
    'Dash',
    'Dogecoin',
    'Ethereum',
    'Litecoin',
    'Maya',
    'Ripple',
    'Solana',
    'THORChain',
    'Tron',
    'Zcash'
  ].map(value => [value, value])
)
const WalletOption = new Proxy({}, { get: (_, name) => String(name) })
const sdkChains = [Chain.Arbitrum, Chain.Avalanche, Chain.Base, Chain.BinanceSmartChain, Chain.Ethereum, Chain.THORChain, Chain.Cosmos]

// Execute the production config/component with deterministic hook and SDK boundaries.
// These are component unit tests, not browser rendering or live wallet-pairing tests.
function load(path, modules) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  })
  const exports = {}
  runInNewContext(outputText, {
    exports,
    require: id => {
      if (!(id in modules)) throw new Error(`Unexpected module: ${id}`)
      return modules[id]
    },
    window: {}
  })
  return exports
}
function harness({ enabled = true, hydrated = true, connected = [], chain } = {}) {
  const events = []
  const config = load('../src/components/connect-wallet/config.tsx', {
    '@tcswap/core': { Chain, WalletOption, getMetaMaskProvider: () => undefined, getEIP6963Provider: () => undefined, okxMobileEnabled: () => false },
    '@tcswap/helpers': { getChainConfig: name => ({ name }) },
    '@tcswap/wallets/binance': { getBinanceBitcoinProvider: () => undefined, getBinanceEVMProvider: () => undefined },
    '@tcswap/wallets/brave': { getBraveEVMProvider: () => undefined, getBraveSolanaProvider: () => undefined },
    '@/lib/wallets': { supportedChains: new Proxy({}, { get: () => sdkChains }), walletConnectEnabled: () => enabled },
    '@/lib/oath-walletconnect': { OATH_WALLET: { name: 'Oath Wallet', app: { ios: 'https://apps.apple.com/app/id6780187283' } } }
  })
  const slots = []
  let cursor = 0
  const slotsHook = initial => {
    const index = cursor++
    if (!(index in slots)) slots[index] = initial
    return [
      slots[index],
      value => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value
      }
    ]
  }
  const modules = {
    'react/jsx-runtime': jsx,
    react: { useState: slotsHook, useRef: initial => slotsHook({ current: initial })[0], useMemo: fn => fn(), useEffect: () => {} },
    'next/image': 'Image',
    '@tcswap/core': { Chain, WalletOption },
    'next-intl': { useTranslations: () => key => key },
    sonner: { toast: { warning: value => events.push(['warning', value]) } },
    '@/components/connect-wallet/config': config,
    '@/hooks/use-wallets': {
      useHasHydrated: () => hydrated,
      useWallets: () => ({
        connectedWallets: connected,
        disconnect: option => events.push(['disconnect', option]),
        connect: async (option, chains, options) => {
          events.push(['connect', option, Array.from(chains), options.walletKey])
          return chains.map(network => ({ network }))
        }
      })
    },
    '@/lib/utils': { cn: (...values) => values.filter(value => typeof value === 'string').join(' ') },
    '@/lib/wallets': { preloadWalletConnect: () => {}, walletConnectEnabled: () => enabled }
  }
  for (const [path, names] of Object.entries({
    '@/components/generic-button': ['GenericButton'],
    '@/components/ui/credenza': ['Credenza', 'CredenzaContent', 'CredenzaHeader', 'CredenzaTitle'],
    '@/components/ui/scroll-area': ['ScrollArea'],
    '@/components/connect-wallet/browser-wallet': ['BrowserWallet'],
    '@/components/connect-wallet/keystore/keystore': ['Keystore'],
    '@/components/connect-wallet/ledger': ['Ledger'],
    '@/components/connect-wallet/trezor': ['Trezor'],
    '@/components/wallet-icon': ['WalletIcon'],
    '@/components/icons': ['Icon']
  }))
    modules[path] = Object.fromEntries(names.map(name => [name, name]))
  const { ConnectWallet } = load('../src/components/connect-wallet/connect-wallet.tsx', modules)
  return {
    config,
    events,
    render() {
      cursor = 0
      return ConnectWallet({ isOpen: true, chain, onOpenChange: open => events.push(['open', open]) })
    }
  }
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...nodes(tree.props?.children)]
}
const row = (tree, label) => nodes(tree).find(node => node.props?.['aria-label'] === label)
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

test('Oath is directly in the mobile group after generic WalletConnect; other groups remain intact', () => {
  const h = harness(),
    tree = h.render()
  const groups = nodes(tree).filter(node => ['browser', 'hardware', 'mobile'].includes(node.key))
  assert.deepEqual(
    groups.map(group => group.key),
    ['browser', 'hardware', 'mobile']
  )
  assert.deepEqual(
    nodes(groups[2])
      .filter(node => node.props?.role === 'button')
      .map(node => node.props['aria-label']),
    ['WalletConnect', 'Oath Wallet']
  )
  assert.ok(row(groups[0], 'Binance Wallet'))
  assert.ok(row(groups[1], 'Ledger'))
  assert.equal(h.config.WALLETS.find(wallet => wallet.key === 'oath').type, h.config.WalletType.mobile)
  const icons = nodes(groups[2]).filter(node => node.type === 'WalletIcon')
  assert.equal(icons.length, 2)
  assert.ok(icons.every(icon => icon.props.width === 32 && icon.props.height === 32))
})

test('no project ID hides both Oath and generic WalletConnect', () => {
  const tree = harness({ enabled: false }).render()
  assert.equal(row(tree, 'Oath Wallet'), undefined)
  assert.equal(row(tree, 'WalletConnect'), undefined)
})

test('Oath click starts its branded flow directly with the supported chain intersection', async () => {
  const h = harness()
  row(h.render(), 'Oath Wallet').props.onClick()
  await settle()
  assert.equal(h.events[0][0], 'open')
  assert.equal(h.events[0][1], false)
  assert.deepEqual(h.events[1], ['connect', WalletOption.WALLETCONNECT, sdkChains.filter(chain => chain !== Chain.Cosmos), 'oath'])
})

test('chain filtering uses Oath support rather than the shared WalletConnect option', async () => {
  const unsupported = harness({ chain: Chain.Cosmos }),
    tree = unsupported.render()
  assert.equal(row(tree, 'Oath Wallet').props['aria-disabled'], true)
  assert.equal(row(tree, 'WalletConnect').props['aria-disabled'], false)
  row(tree, 'Oath Wallet').props.onClick()
  assert.equal(unsupported.events.length, 0)
  const supported = harness({ chain: Chain.THORChain })
  row(supported.render(), 'Oath Wallet').props.onClick()
  await settle()
  assert.deepEqual(supported.events[1][2], [Chain.THORChain])
})

test('generic mobile WalletConnect still renders its existing connection screen', () => {
  const h = harness()
  row(h.render(), 'WalletConnect').props.onClick()
  const selected = nodes(h.render()).find(node => node.type === 'BrowserWallet')
  assert.equal(selected.props.wallet.key, 'walletconnect')
  assert.equal(h.events.length, 0)
})

test('existing sessions require explicit replacement before starting Oath', async () => {
  const h = harness({ connected: [WalletOption.WALLETCONNECT], chain: Chain.THORChain })
  row(h.render(), 'Oath Wallet').props.onClick()
  assert.equal(h.events.length, 0)
  const button = nodes(h.render()).find(node => node.type === 'GenericButton')
  assert.equal(button.props.children, 'oathReplaceSession')
  button.props.onClick()
  await settle()
  assert.deepEqual(
    h.events.map(event => event[0]),
    ['disconnect', 'open', 'connect']
  )
  assert.deepEqual(h.events[2][2], [Chain.THORChain])
})

test('Oath cannot connect until stored sessions have hydrated; keyboard activation works afterward', async () => {
  const waiting = harness({ hydrated: false }),
    pending = row(waiting.render(), 'Oath Wallet')
  assert.equal(pending.props['aria-disabled'], true)
  pending.props.onClick()
  assert.equal(waiting.events.length, 0)
  const ready = harness()
  let prevented = false
  row(ready.render(), 'Oath Wallet').props.onKeyDown({
    key: 'Enter',
    preventDefault: () => {
      prevented = true
    }
  })
  await settle()
  assert.equal(prevented, true)
  assert.equal(ready.events[1][0], 'connect')
})
