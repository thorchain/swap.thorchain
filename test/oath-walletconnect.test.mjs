import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Run the production presentation/session policy, not a reimplementation. The SDK's public
// controller API is injected so cancellation/races can be tested without a relay or wallet funds.
const source = readFileSync(new URL('../src/lib/oath-walletconnect.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
const { OATH_WALLET, presentOathWallet, connectOathWallet, isIOSDevice, queueWalletConnect } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

function controller(state) {
  const listeners = new Set()
  return {
    state,
    listeners,
    subscribe: callback => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    update(values) {
      Object.assign(state, values)
      queueMicrotask(() => listeners.forEach(callback => callback(state)))
    }
  }
}
function controls() {
  const ConfigCtrl = controller({ projectId: 'test-project', walletImages: { existing: '/existing.svg' } })
  ConfigCtrl.setConfig = value => ConfigCtrl.update(value)
  const ModalCtrl = controller({ open: false })
  const OptionsCtrl = controller({ walletConnectUri: undefined })
  const RouterCtrl = controller({ view: 'ConnectWallet', data: undefined, history: ['ConnectWallet'] })
  RouterCtrl.reset = view => RouterCtrl.update({ view, history: [view] })
  RouterCtrl.setData = data => RouterCtrl.update({ data })
  return { ConfigCtrl, ModalCtrl, OptionsCtrl, RouterCtrl }
}
async function open(c, uri) {
  c.OptionsCtrl.update({ walletConnectUri: uri })
  c.RouterCtrl.reset('ConnectWallet')
  c.ModalCtrl.update({ open: true })
  await flush()
}
function disposed(c) {
  for (const ctrl of Object.values(c)) assert.equal(ctrl.listeners.size, 0)
}

test('desktop goes directly to branded QR/instructions, including the SDK second open', async () => {
  const c = controls(),
    presentation = presentOathWallet(c, false)
  await open(c)
  assert.equal(c.RouterCtrl.state.view, 'MobileQrcodeConnecting')
  await open(c, 'wc:test-fixture@2?relay-protocol=irn&symKey=test-only')
  assert.equal(c.RouterCtrl.state.view, 'MobileQrcodeConnecting')
  assert.deepEqual(c.RouterCtrl.state.data.Wallet, OATH_WALLET)
  assert.equal(c.ConfigCtrl.state.walletImages['oath-ios'], '/wallets/oath.svg')
  assert.equal(presentation.didOpen(), true)
  presentation.dispose()
  await flush()
  disposed(c)
  assert.deepEqual(c.ConfigCtrl.state.walletImages, { existing: '/existing.svg' })
  assert.equal(c.RouterCtrl.state.view, 'ConnectWallet')
  assert.equal(c.RouterCtrl.state.data, undefined)
})

test('iOS waits for URI before deep-link view; desktop and Android keep QR', async () => {
  const c = controls(),
    presentation = presentOathWallet(c, true)
  await open(c)
  assert.equal(c.RouterCtrl.state.view, 'MobileQrcodeConnecting')
  await open(c, 'wc:fixture@2?relay-protocol=irn&symKey=test-only')
  assert.equal(c.RouterCtrl.state.view, 'MobileConnecting')
  assert.equal(c.RouterCtrl.state.data.Wallet.mobile.native, 'oathwallet://')
  assert.equal(c.RouterCtrl.state.data.Wallet.app.ios, 'https://apps.apple.com/app/id6780187283')
  presentation.dispose()
  disposed(c)
  assert.equal(isIOSDevice({ userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5 }), true)
  assert.equal(isIOSDevice({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 }), true)
  assert.equal(isIOSDevice({ userAgent: 'Android', platform: 'Linux', maxTouchPoints: 5 }), false)
  assert.equal(isIOSDevice({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 }), false)
})

test('successful fresh pairing is never disconnected or repeated', async () => {
  const c = controls()
  let calls = 0
  assert.equal(
    await connectOathWallet(
      c,
      false,
      async () => {
        calls++
        await open(c, 'wc:fixture')
        return true
      },
      () => assert.fail('disconnect')
    ),
    true
  )
  assert.equal(calls, 1)
  disposed(c)
})

test('stale restored session must be ended before Oath fresh pairing', async () => {
  const c = controls(),
    events = []
  await connectOathWallet(
    c,
    false,
    async () => {
      events.push('connect')
      if (events.length > 1) await open(c, 'wc:fixture')
      return true
    },
    () => events.push('disconnect')
  )
  assert.deepEqual(events, ['connect', 'disconnect', 'connect'])
  disposed(c)
})

test('dismissal or rejection restores generic modal and never retries', async () => {
  for (const afterOpen of [false, true]) {
    const c = controls()
    let calls = 0
    await assert.rejects(
      connectOathWallet(
        c,
        false,
        async () => {
          calls++
          if (afterOpen) await open(c, 'wc:fixture')
          throw new Error('wallet_walletconnect_modal_closed')
        },
        () => assert.fail('disconnect')
      ),
      /modal_closed/
    )
    assert.equal(calls, 1)
    disposed(c)
    assert.deepEqual(c.ConfigCtrl.state.walletImages, { existing: '/existing.svg' })
    assert.equal(c.RouterCtrl.state.view, 'ConnectWallet')
  }
})

test('generic connects wait for branded setup and still run after failure', async () => {
  const events = []
  let release
  const gate = new Promise(resolve => {
    release = resolve
  })
  const oath = queueWalletConnect(async () => {
    events.push('oath')
    await gate
    events.push('cleanup')
    throw new Error('cancelled')
  })
  const generic = queueWalletConnect(async () => {
    events.push('generic')
    return true
  })
  await flush()
  assert.deepEqual(events, ['oath'])
  release()
  await assert.rejects(oath, /cancelled/)
  assert.equal(await generic, true)
  assert.deepEqual(events, ['oath', 'cleanup', 'generic'])
})
