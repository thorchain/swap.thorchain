import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { buildSchema, parse, validate } from 'graphql'
import { BORROW_MARKETS_QUERY } from '../src/lib/rujira/borrow-query.ts'
import { getBorrowMarkets as mapBorrowMarkets } from '../src/lib/rujira/borrow-markets.ts'
import { borrowAmountForLtv, calculateBorrowPreview } from '../src/lib/rujira/borrow-preview.ts'
import { getBorrowUrl } from '../src/lib/rujira/borrow-link.ts'

test('Borrow links select collateral then debt and preserve the external payout network', () => {
  const btc = { ticker: 'BTC', chain: 'BTC' }
  const usdc = { ticker: 'USDC', chain: 'ETH' }
  assert.equal(getBorrowUrl(btc, usdc), 'https://rujira.network/borrow/BTC/USDC?toChain=ETH')
  assert.equal(getBorrowUrl(btc, { ...usdc, isSecuredAsset: true }), 'https://rujira.network/borrow/BTC/USDC')
  assert.equal(getBorrowUrl({ ...usdc, chain: 'AVAX' }, btc), 'https://rujira.network/borrow/USDC.AVAX/BTC?toChain=BTC')
  assert.equal(getBorrowUrl(btc, { ticker: 'USDT', chain: 'TRON' }), 'https://rujira.network/borrow/BTC/USDT.TRON?toChain=TRON')
  assert.equal(getBorrowUrl(btc, { ticker: 'RUNE', chain: 'THOR' }), 'https://rujira.network/borrow/BTC/RUNE')
  assert.equal(getBorrowUrl(btc, undefined), 'https://rujira.network/borrow')
  assert.equal(getBorrowUrl(undefined, usdc), 'https://rujira.network/borrow')
})

const getBorrowMarkets = data =>
  mapBorrowMarkets({
    ghostCredit: data.ghostCredit && {
      adjustmentThreshold: '900000000000',
      liquidationThreshold: '1000000000000',
      ...data.ghostCredit,
      vaults: data.ghostCredit.vaults.map(v => ({
        ...v,
        borrower: {
          ...v.borrower,
          vault: v.borrower.vault ?? {
            interest: { baseRate: '0', step1: '50000000000', step2: '950000000000', targetUtilization: '850000000000' },
            status: { debtRate: '40000000000', depositPool: { size: '100000000000' }, debtPool: { size: '50000000000' } }
          }
        }
      }))
    }
  })

const asset = (ticker, type = 'SECURED') => ({
  asset: `ETH-${ticker}`,
  chain: 'ETH',
  type,
  metadata: { symbol: ticker, decimals: 8, name: null, pngUrl: null }
})
const price = { current: '1234567890123' }

test('Borrow query matches the main schema and has no mutation', () => {
  const schema = buildSchema(readFileSync(new URL('../data/graphql/rujira-schema.graphql', import.meta.url), 'utf8'))
  const document = parse(BORROW_MARKETS_QUERY)
  assert.deepEqual(validate(schema, document), [])
  assert.ok(document.definitions.filter(d => d.kind === 'OperationDefinition').every(d => d.operation === 'query'))
})

test('only strictly positive collateral ratios appear in Deposit, including tiny ratios', () => {
  const result = getBorrowMarkets({
    ghostCredit: {
      collaterals: ['0', '-1', '1', '700000000000'].map((ratio, i) => ({ ratio, asset: asset(`TOKEN${i}`), price })),
      vaults: []
    }
  })
  assert.deepEqual(
    result.depositAssets.map(a => a.ticker),
    ['TOKEN2', 'TOKEN3']
  )
  assert.equal(result.depositAssets[0].usdPrice, '1.234567890123')
})

test('Borrow comes from lending vaults, not the collateral list; an empty vault is still listed', () => {
  const result = getBorrowMarkets({
    ghostCredit: {
      collaterals: [{ ratio: '1', asset: asset('COLLATERAL'), price }],
      vaults: [{ borrower: { available: '0', asset: asset('DEBT') }, price: null }]
    }
  })
  assert.deepEqual(
    result.borrowAssets.map(a => a.ticker),
    ['DEBT']
  )
  assert.equal(result.borrowAssets[0].usdPrice, null)
  assert.equal(result.borrowAssets[0].isSecuredAsset, true)
})

test('Layer 1 variants retain their own decimals and the original collateral identity', () => {
  const source = asset('USDC')
  source.variants = { layer1: { ...asset('USDC', 'LAYER_1'), asset: 'ETH.USDC-0xabc', metadata: { ...source.metadata, decimals: 6 } } }
  const result = getBorrowMarkets({ ghostCredit: { collaterals: [{ ratio: '1', asset: source, price }], vaults: [] } })
  assert.equal(result.depositAssets[0].identifier, 'ETH.USDC-0xabc')
  assert.equal(result.depositAssets[0].marketId, 'ETH-USDC')
  assert.equal(result.depositAssets[0].decimals, 6)
  assert.equal(result.depositAssets[0].isSecuredAsset, undefined)
})

test('missing Ghost data fails instead of pretending the market is empty', () => {
  assert.throws(() => getBorrowMarkets({ ghostCredit: null }), /unavailable/)
})

test('rate, threshold and pool units use protocol precision rather than Layer 1 decimals', () => {
  const source = asset('USDC')
  source.variants = { layer1: { ...asset('USDC', 'LAYER_1'), asset: 'ETH.USDC-0xabc', metadata: { ...source.metadata, decimals: 6 } } }
  const markets = getBorrowMarkets({
    ghostCredit: { collaterals: [{ ratio: '700000000000', asset: source, price }], vaults: [{ borrower: { available: '0', asset: source }, price }] }
  })
  assert.equal(markets.adjustmentThreshold, '0.9')
  assert.equal(markets.liquidationThreshold, '1')
  assert.equal(markets.depositAssets[0].collateralRatio, '0.7')
  assert.equal(markets.borrowAssets[0].borrowRate, '0.04')
  assert.equal(markets.borrowAssets[0].interest.totalDeposits, '1000')
  assert.equal(markets.borrowAssets[0].interest.totalDebt, '500')
  assert.equal(markets.borrowAssets[0].decimals, 6)
})

const collateral = { marketId: 'BTC-BTC', usdPrice: '100', collateralRatio: '0.7', decimals: 8 }
const debt = { marketId: 'ETH-USDC', usdPrice: '1', decimals: 6, borrowRate: '0.03' }

test('LTV uses adjusted collateral; liquidation price uses the live liquidation threshold', () => {
  const preview = calculateBorrowPreview(collateral, debt, '2', '35', '1')
  assert.equal(preview.ltvPercent, 25)
  assert.equal(preview.liquidationPrice, '25')
  assert.equal(calculateBorrowPreview(collateral, debt, '2', '35', '0.8').liquidationPrice, '31.25')
})

test('liquidation ratio is quoted in borrowed tokens per collateral token, separate from its USD value', () => {
  const preview = calculateBorrowPreview(collateral, { ...debt, usdPrice: '2' }, '2', '35', '1')
  assert.equal(preview.liquidationRatio, '25')
  assert.equal(preview.liquidationPrice, '50')
  const smallRatio = calculateBorrowPreview({ ...collateral, usdPrice: '1' }, { ...debt, usdPrice: '100000' }, '100', '0.0001', '1')
  assert.equal(smallRatio.liquidationRatio, '0.000001428571428571428571428571428571428571429')
  assert.equal(calculateBorrowPreview(collateral, debt, '1', '0', '1').liquidationRatio, null)
  assert.equal(calculateBorrowPreview(collateral, { ...debt, marketId: collateral.marketId }, '1', '10', '1').liquidationRatio, null)
  assert.equal(calculateBorrowPreview(collateral, { ...debt, usdPrice: null }, '1', '10', '1').liquidationRatio, null)
})

test('slider spans actual 0–100% LTV and rounds down to the debt asset decimals', () => {
  assert.equal(borrowAmountForLtv(collateral, debt, '2', 0), '0')
  assert.equal(borrowAmountForLtv(collateral, debt, '2', 50), '70')
  assert.equal(borrowAmountForLtv(collateral, debt, '2', 100), '140')
  assert.equal(borrowAmountForLtv(collateral, { ...debt, usdPrice: '3' }, '1', 50), '11.666666')
})

test('projected APR follows both sides of the utilization curve', () => {
  const borrow = {
    ...debt,
    interest: { baseRate: '0.01', step1: '0.04', step2: '0.4', targetUtilization: '0.8', totalDeposits: '1000', totalDebt: '400' }
  }
  assert.equal(calculateBorrowPreview(collateral, borrow, '10', '100', '1').interestRate, '0.035')
  assert.equal(calculateBorrowPreview(collateral, borrow, '10', '500', '1').interestRate, '0.23')
  assert.equal(calculateBorrowPreview(collateral, borrow, '10', '0', '1').interestRate, '0.03')
})

test('empty input, missing prices, zero debt and same-asset pairs do not invent a liquidation price', () => {
  assert.equal(borrowAmountForLtv(collateral, debt, '', 50), null)
  assert.equal(borrowAmountForLtv({ ...collateral, usdPrice: null }, debt, '1', 50), null)
  assert.equal(calculateBorrowPreview(collateral, debt, '.', '.', '1').ltvPercent, null)
  assert.equal(calculateBorrowPreview(collateral, debt, '1', '.', '1').ltvPercent, 0)
  assert.equal(calculateBorrowPreview(collateral, debt, '1', '0', '1').liquidationPrice, null)
  assert.equal(calculateBorrowPreview(collateral, { ...debt, marketId: collateral.marketId }, '1', '10', '1').liquidationPrice, null)
  assert.equal(calculateBorrowPreview(collateral, debt, '1', '10').liquidationPrice, null)
})

const createTransport = responses => {
  const source = readFileSync(new URL('../src/lib/rujira/client.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const requests = []
  const waits = []
  const clock = { value: 0 }
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: name => {
      if (name === 'server-only') return {}
      if (name === './borrow-query') return { BORROW_MARKETS_QUERY }
      if (name === './borrow-markets') return { getBorrowMarkets: mapBorrowMarkets }
      throw new Error(`Unexpected import: ${name}`)
    },
    process: { env: { RUJIRA_API_KEY: 'fixture-key' } },
    AbortSignal,
    Date: { now: () => clock.value },
    setTimeout: (callback, milliseconds) => {
      waits.push(milliseconds)
      callback()
    },
    fetch: async (url, options) => {
      requests.push({ url, options })
      assert.ok(responses.length, 'an upstream response was expected')
      return Response.json(responses.shift())
    }
  })
  return { client: module.exports, requests, waits, clock }
}
const success = () => ({
  data: { ghostCredit: { adjustmentThreshold: '900000000000', liquidationThreshold: '1000000000000', collaterals: [], vaults: [] } }
})
const rateLimited = () => ({ errors: [{ message: 'rate bucket full (5000). bucket drains 500/s.' }] })

test('server sends authenticated requests, deduplicates callers and caches validated results for 30 seconds', async () => {
  const { client, requests, clock } = createTransport([success(), success()])
  await Promise.all([client.fetchBorrowMarkets(), client.fetchBorrowMarkets()])
  await client.fetchBorrowMarkets()
  assert.equal(requests.length, 1)
  assert.equal(requests[0].options.headers.authorization, 'Bearer fixture-key')
  assert.equal(requests[0].options.cache, 'no-store')
  clock.value = 30_001
  await client.fetchBorrowMarkets()
  assert.equal(requests.length, 2)
})

test('rate limits receive exactly one delayed retry and failed results are not cached', async () => {
  const { client, requests, waits } = createTransport([rateLimited(), rateLimited(), success()])
  await assert.rejects(client.fetchBorrowMarkets(), error => error.code === 'rate_limited' && error.message.includes('rate bucket full'))
  assert.equal(requests.length, 2)
  assert.equal(waits.length, 1)
  assert.equal(waits[0], 10_000)
  await client.fetchBorrowMarkets()
  assert.equal(requests.length, 3)
})

test('an analytics rate-limit retry keeps the analytics endpoint instead of falling back to Main', async () => {
  const { client, requests } = createTransport([rateLimited(), success()])
  await client.requestRujira('query Metrics { analytics { __typename } }', undefined, true, 'https://analytics.example/api/v2/graphql')
  assert.equal(requests.length, 2)
  assert.ok(requests.every(request => request.url === 'https://analytics.example/api/v2/graphql'))
})
