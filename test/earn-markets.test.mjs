import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { QueryClient } from '@tanstack/react-query'
import ts from 'typescript'
import { buildSchema, parse, validate } from 'graphql'
import {
  EARN_TRADE_QUERY,
  EARN_LENDING_QUERY,
  EARN_STAKING_QUERY,
  EARN_CCL_METRICS_QUERY,
  EARN_STAKING_METRICS_QUERY
} from '../src/lib/rujira/earn-query.ts'
import {
  tradeEarnMarkets as mapTradeMarkets,
  lendingEarnMarkets,
  stakingEarnMarkets,
  topEarnOpportunities,
  toEarnAsset
} from '../src/lib/rujira/earn-markets.ts'

const asset = (symbol, chain = 'ETH', identifier = `${chain}-${symbol}`) => ({
  asset: identifier,
  chain,
  type: 'SECURED',
  metadata: { symbol, decimals: 8 }
})
const pair = (id, base, quote, apr) => ({
  id,
  address: id,
  assetBase: base,
  assetQuote: quote,
  analyticsApr: apr
})

const tradeEarnMarkets = pairs =>
  mapTradeMarkets(
    pairs,
    pairs.map(pair => ({ strategy: { pair: { contractAddress: pair.address } }, apr: pair.analyticsApr }))
  )

const stakingHistory = (...aprs) => ({ history: aprs.map(apr => ({ isComplete: true, apr })) })

test('Earn operations validate against the schema and are read-only', () => {
  const schema = buildSchema(readFileSync(new URL('../data/graphql/rujira-schema.graphql', import.meta.url), 'utf8'))
  for (const query of [EARN_TRADE_QUERY, EARN_LENDING_QUERY, EARN_STAKING_QUERY]) {
    const document = parse(query)
    assert.deepEqual(validate(schema, document), [])
    assert.ok(document.definitions.filter(d => d.kind === 'OperationDefinition').every(d => d.operation === 'query'))
  }
  const analyticsSchema = buildSchema(readFileSync(new URL('../data/graphql/rujira-analytics-schema.graphql', import.meta.url), 'utf8'))
  for (const query of [EARN_CCL_METRICS_QUERY, EARN_STAKING_METRICS_QUERY]) assert.deepEqual(validate(analyticsSchema, parse(query)), [])
})

test('Trade asset catalogue includes both sides, keeps chain variants, and deduplicates by full identifier', () => {
  const btc = asset('BTC', 'BTC'),
    ethUsdt = asset('USDT'),
    tronUsdt = asset('USDT', 'TRON')
  const result = tradeEarnMarkets([pair('one', btc, ethUsdt, '0.1'), pair('two', tronUsdt, btc, '0.2')])
  assert.equal(result.assets.length, 3)
  assert.deepEqual(
    result.assets
      .filter(a => a.ticker === 'USDT')
      .map(a => a.chain)
      .sort(),
    ['ETH', 'TRON']
  )
  assert.equal(result.opportunities[0].apr, '0.1')
})

test('rank after matching either side, not after limiting the overall leaders', () => {
  const btc = asset('BTC', 'BTC'),
    eth = asset('ETH'),
    usdc = asset('USDC')
  const rows = tradeEarnMarkets([
    ...[9, 8, 7, 6].map(n => pair(`global${n}`, eth, usdc, `${n}`)),
    pair('btc-low', btc, usdc, '0.1'),
    pair('btc-high', eth, btc, '0.3'),
    pair('btc-mid', btc, eth, '0.2'),
    pair('btc-missing', eth, btc, null)
  ]).opportunities
  assert.deepEqual(
    topEarnOpportunities(rows, 'BTC-BTC').map(r => r.id),
    ['btc-high', 'btc-mid', 'btc-low']
  )
  assert.deepEqual(
    topEarnOpportunities(rows).map(r => r.id),
    ['global9', 'global8', 'global7']
  )
})

test('missing APR sorts below zero and APR precision is preserved for ranking', () => {
  const result = tradeEarnMarkets([
    pair('missing', asset('ETH'), asset('BTC'), null),
    pair('zero', asset('ETH'), asset('BTC'), '0'),
    pair('smaller', asset('ETH'), asset('BTC'), '0.12345678901200000000001'),
    pair('larger', asset('ETH'), asset('BTC'), '0.12345678901200000000002')
  ])
  assert.deepEqual(
    topEarnOpportunities(result.opportunities).map(r => r.id),
    ['larger', 'smaller', 'zero']
  )
})

test('lending uses supply APR rather than the borrow rate and does not invent extra vaults', () => {
  const markets = lendingEarnMarkets([
    { id: 'btc-vault', asset: asset('BTC', 'BTC'), status: { lendRate: '40000000000' } },
    { id: 'eth-vault', asset: asset('ETH'), status: { lendRate: '60000000000' } }
  ])
  assert.equal(topEarnOpportunities(markets.opportunities, 'BTC-BTC').length, 1)
  assert.equal(markets.opportunities[0].apr, '0.04')
})

test('staking ranks available APR and retains missing APR as null for N/A', () => {
  const markets = stakingEarnMarkets(
    [
      { id: 'soon', bondAsset: asset('RUJI', 'THOR', 'THOR.RUJI') },
      { id: 'zero', bondAsset: asset('TCY', 'THOR', 'THOR.TCY') },
      { id: 'high', bondAsset: asset('bRUNE', 'THOR', 'x/brune') }
    ],
    { ruji: stakingHistory(null), tcy: stakingHistory('0'), brune: stakingHistory('0.09') }
  )
  assert.deepEqual(
    topEarnOpportunities(markets.opportunities).map(r => r.id),
    ['high', 'zero', 'soon']
  )
  assert.equal(markets.opportunities[0].apr, null)
})

test('CCL joins analytics by contract, preserves decimal ratios and never falls back to the old main APR', () => {
  const pairs = [
    { ...pair('opaque-main-id', asset('BTC', 'BTC'), asset('USDC'), null), address: 'thor1pair', rangeSummary: { aprMonth: '999000000000000' } }
  ]
  assert.equal(mapTradeMarkets(pairs).opportunities.length, 0)
  assert.equal(mapTradeMarkets(pairs).assets.length, 2)
  const result = mapTradeMarkets(pairs, [{ strategy: { pair: { contractAddress: 'thor1pair' } }, apr: '0.6222934051620437526054038308003781' }])
  assert.equal(result.opportunities[0].apr, '0.6222934051620437526054038308003781')
})

test('asset prices come from the schema and retain the 12-decimal Main API scale', () => {
  assert.equal(toEarnAsset({ ...asset('BTC', 'BTC'), price: { current: '75597797700000000' } }).usdPrice, '75597.7977')
  assert.equal(toEarnAsset({ ...asset('USDC'), price: { current: '0' } }).usdPrice, '0')
  assert.equal(toEarnAsset(asset('UNKNOWN')).usdPrice, null)
})

test('staking uses daily analytics over current and legacy summaries, without matching arbitrary ticker copies', () => {
  const rows = stakingEarnMarkets(
    [
      { id: 'ruji', bondAsset: asset('RUJI', 'THOR', 'THOR.RUJI'), summary: { apr: { value: '0', status: 'AVAILABLE' } } },
      { id: 'other', bondAsset: asset('RUJI', 'ETH', 'ETH.RUJI') }
    ],
    { ruji: { ...stakingHistory('0.03', '0.05'), current: { apr: '0.99', asOf: '' } } }
  )
  assert.equal(rows.opportunities[0].apr, '0.04')
  assert.equal(rows.opportunities[1].apr, null)
})

test('staking averages 30 daily APRs and ranks their means rather than their latest values', () => {
  const rows = stakingEarnMarkets(
    [
      { id: 'ruji', bondAsset: asset('RUJI', 'THOR', 'THOR.RUJI') },
      { id: 'tcy', bondAsset: asset('TCY', 'THOR', 'THOR.TCY') }
    ],
    { ruji: stakingHistory(...Array(29).fill('0.06'), '0'), tcy: stakingHistory(...Array(29).fill('0.03'), '0.09') }
  )
  assert.equal(rows.opportunities[0].apr, '0.058')
  assert.equal(rows.opportunities[1].apr, '0.032')
  assert.deepEqual(
    topEarnOpportunities(rows.opportunities).map(row => row.id),
    ['ruji', 'tcy']
  )
})

test('staking includes zero days but excludes missing, invalid, negative and unfinished APR points', () => {
  const metrics = stakingHistory('0', '0.06', null, 'invalid', 'NaN', 'Infinity', '-0.5')
  metrics.history.push({ isComplete: false, apr: '0.99' })
  const rows = stakingEarnMarkets([{ id: 'ruji', bondAsset: asset('RUJI', 'THOR', 'THOR.RUJI') }], { ruji: metrics })
  assert.equal(rows.opportunities[0].apr, '0.03')
})

test('staking keeps unavailable history as null and never falls back to the current snapshot', () => {
  const pool = { id: 'ruji', bondAsset: asset('RUJI', 'THOR', 'THOR.RUJI') }
  for (const history of [null, [], [{ isComplete: true, apr: null }], [{ isComplete: false, apr: '0.5' }]]) {
    const rows = stakingEarnMarkets([pool], { ruji: { history, current: { apr: '0.9', asOf: '' } } })
    assert.equal(rows.opportunities[0].apr, null)
  }
})

const createEarnQuery = (mode, responses) => {
  const source = readFileSync(new URL('../src/hooks/use-earn-markets.ts', import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: name => {
      assert.equal(name, '@tanstack/react-query')
      return { queryOptions: options => options, useQuery: options => options }
    },
    fetch: async () => {
      assert.ok(responses.length, 'an API response was expected')
      return responses.shift()
    }
  })
  const options = { ...module.exports.useEarnMarkets(mode), retry: false }
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
  return {
    client,
    options,
    fetch: async () => {
      await client.invalidateQueries({ queryKey: options.queryKey, refetchType: 'none' })
      return client.fetchQuery(options)
    }
  }
}

for (const mode of ['automated', 'lending', 'staking']) {
  test(`${mode} shares an in-flight prefetch and its fresh cache with the tab`, async () => {
    const markets = { assets: [], opportunities: [{ id: 'prefetched', assets: [], apr: '0.1' }] }
    let resolveResponse
    const response = new Promise(resolve => {
      resolveResponse = resolve
    })
    const query = createEarnQuery(mode, [response])
    const prefetch = query.client.prefetchQuery(query.options)
    const foreground = query.client.fetchQuery(query.options)
    resolveResponse(Response.json(markets))
    await prefetch
    assert.deepEqual(await foreground, markets)
    assert.deepEqual(await query.client.fetchQuery(query.options), markets)
    query.client.clear()
  })

  test(`${mode} can load normally after a silent prefetch failure`, async () => {
    const markets = { assets: [], opportunities: [] }
    const query = createEarnQuery(mode, [Response.json({}, { status: 503 }), Response.json(markets)])
    await query.client.prefetchQuery(query.options)
    assert.equal(query.client.getQueryData(query.options.queryKey), undefined)
    assert.deepEqual(await query.client.fetchQuery(query.options), markets)
    query.client.clear()
  })

  test(`${mode} keeps the previous snapshot after a failed refresh and recovers on success`, async () => {
    const original = { assets: [], opportunities: [{ id: 'original', assets: [], apr: '0.1' }] }
    const updated = { assets: [], opportunities: [{ id: 'updated', assets: [], apr: '0.2' }] }
    const query = createEarnQuery(mode, [Response.json(original), Response.json({}, { status: 503 }), Response.json(updated)])
    const initial = await query.fetch()
    const updatedAt = query.client.getQueryState(query.options.queryKey).dataUpdatedAt
    await assert.rejects(query.fetch(), /Earn data is unavailable/)
    assert.equal(query.client.getQueryData(query.options.queryKey), initial)
    assert.equal(query.client.getQueryState(query.options.queryKey).dataUpdatedAt, updatedAt)
    assert.deepEqual(await query.fetch(), updated)
    query.client.clear()
  })

  test(`${mode} preserves displayed rates when a refresh returns unavailable analytics`, async () => {
    const original = { assets: [], opportunities: [{ id: 'original', assets: [], apr: '0.1' }] }
    const partial = { assets: [], opportunities: [], metricsUnavailable: true }
    const query = createEarnQuery(mode, [Response.json(original), Response.json(partial)])
    const initial = await query.fetch()
    await assert.rejects(query.fetch(), /Earn data is unavailable/)
    assert.equal(query.client.getQueryData(query.options.queryKey), initial)
    query.client.clear()
  })
}

test('an initial Earn load can show partial market data, while an initial HTTP failure remains an error', async () => {
  const partial = { assets: [], opportunities: [], metricsUnavailable: true }
  const query = createEarnQuery('automated', [Response.json({}, { status: 502 }), Response.json(partial)])
  await assert.rejects(query.fetch(), /Earn data is unavailable/)
  assert.equal(query.client.getQueryData(query.options.queryKey), undefined)
  assert.deepEqual(await query.fetch(), partial)
  query.client.clear()
})
