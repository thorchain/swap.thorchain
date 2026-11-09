import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { QueryClient } from '@tanstack/react-query'
import ts from 'typescript'
import { buildSchema, parse, validate, visit, valueFromASTUntyped } from 'graphql'
import { loadRujiraModule } from './rujira-module.mjs'

const { EARN_TRADE_QUERY, EARN_LENDING_QUERY, EARN_STAKING_QUERY, EARN_AUTOMATED_METRICS_QUERY } = loadRujiraModule('earn-query')
const { tradeEarnMarkets, lendingEarnMarkets, stakingEarnMarkets, topEarnOpportunities } = loadRujiraModule('earn-markets')
const { toAnalyticsAsset } = loadRujiraModule('analytics-markets')
const { paginateAnalytics } = loadRujiraModule('client')
const token = (symbol, chain = 'ETH', id = `${chain}-${symbol}`) => ({ id, symbol, chain: { id: chain }, decimals: 8 })
const pair = (id, baseToken, quoteToken) => ({ pair: { id, baseToken, quoteToken } })
const metric = (id, apr) => ({ strategy: { pair: { id } }, apr })
const pool = (id, stakedToken, apr) => ({ pool: { id, stakedToken }, current: { apr } })
const page = (nodes, hasNextPage = false, endCursor = null) => ({ nodes, pageInfo: { hasNextPage, endCursor } })
const products = data => ({ analytics: { products: data } })

test('all Earn operations validate against Analytics v2 and are read-only', () => {
  const schema = buildSchema(readFileSync(new URL('../data/graphql/rujira-analytics-schema.graphql', import.meta.url), 'utf8'))
  for (const query of [EARN_TRADE_QUERY, EARN_LENDING_QUERY, EARN_STAKING_QUERY, EARN_AUTOMATED_METRICS_QUERY]) {
    const document = parse(query)
    assert.deepEqual(validate(schema, document), [])
    assert.ok(document.definitions.filter(d => d.kind === 'OperationDefinition').every(d => d.operation === 'query'))
  }
})

test('automated asks v2 for the higher CCL/DCL APR per pair over the same 30-day range', () => {
  let selection
  let aprArgs
  visit(parse(EARN_AUTOMATED_METRICS_QUERY), {
    Field(node) {
      const args = Object.fromEntries((node.arguments ?? []).map(arg => [arg.name.value, valueFromASTUntyped(arg.value)]))
      if (node.name.value === 'strategies') selection = args
      if (node.name.value === 'apr') aprArgs = args
    }
  })
  assert.deepEqual(selection.filter.typeIds, ['CCL', 'DCL'])
  assert.equal(selection.onePerPair, true)
  assert.equal(selection.orderBy.field, 'APR')
  assert.equal(selection.orderBy.direction, 'DESC')
  assert.equal(aprArgs.range.trailing.value, 30)
  assert.equal(aprArgs.range.trailing.unit, 'DAY')
  assert.deepEqual(selection.orderBy.range, aprArgs.range)
})

test('Trade includes both sides and all catalogue assets while ranking returned CCL/DCL winners by stable pair identity', () => {
  const btc = token('BTC', 'BTC'),
    usdt = token('USDT'),
    tronUsdt = token('USDT.TRON', 'TRON')
  const rows = tradeEarnMarkets([pair('ccl', btc, usdt), pair('no-ccl', btc, tronUsdt)], [metric('ccl', '0.100000000000000000001')])
  assert.equal(rows.assets.length, 3)
  assert.deepEqual(
    rows.assets
      .filter(a => a.ticker === 'USDT')
      .map(a => a.chain)
      .sort(),
    ['ETH', 'TRON']
  )
  assert.deepEqual(
    rows.opportunities.map(row => row.id),
    ['ccl']
  )
  assert.equal(rows.opportunities[0].apr, '0.100000000000000000001')
})

test('Earn excludes xUSK, NAMI and AUTO from every catalogue', () => {
  const excluded = [token('xUSK'), token('nami'), token('AUTO')],
    btc = token('BTC', 'BTC')
  const tokens = [...excluded, btc]
  const pairs = tokens.map(t => pair(t.id, t, btc))
  const results = [
    tradeEarnMarkets(
      pairs,
      pairs.map(p => metric(p.pair.id, '0.1'))
    ),
    lendingEarnMarkets(tokens.map(token => ({ id: token.id, token, apr: '0.1' }))),
    stakingEarnMarkets(Object.fromEntries(tokens.map(t => [t.id, pool(t.id, t, '0.1')])))
  ]
  for (const result of results) {
    assert.deepEqual(
      result.assets.map(a => a.ticker),
      ['BTC']
    )
    assert.equal(result.opportunities.length, 1)
  }
})

test('ranking filters the entire catalogue before taking three and preserves APR precision, zero and null', () => {
  const btc = token('BTC', 'BTC'),
    eth = token('ETH'),
    usdc = token('USDC')
  const excluded = [
    pair('tcy-base', token('TCY', 'THOR'), btc),
    pair('tcy-quote', btc, token('tcy', 'THOR')),
    pair('atom-base', token('ATOM', 'GAIA'), btc),
    pair('atom-quote', btc, token('atom', 'GAIA'))
  ]
  const pairs = [
    ...[9, 8, 7, 6].map(n => pair(`global${n}`, eth, usdc)),
    ...['low', 'high', 'zero', 'missing'].map(id => pair(id, btc, usdc)),
    ...excluded
  ]
  const metrics = [
    ...excluded.map(p => metric(p.pair.id, '100')),
    ...[9, 8, 7, 6].map(n => metric(`global${n}`, String(n))),
    metric('low', '0.12345678901200000000001'),
    metric('high', '0.12345678901200000000002'),
    metric('zero', '0'),
    metric('missing', null)
  ]
  const rows = tradeEarnMarkets(pairs, metrics).opportunities
  assert.deepEqual(
    topEarnOpportunities(rows, 'BTC-BTC').map(r => r.id),
    ['high', 'low', 'zero']
  )
  assert.deepEqual(
    topEarnOpportunities(rows).map(r => r.id),
    ['global9', 'global8', 'global7']
  )
})

test('v2 token mapping preserves exact identities, Layer 1 decimals and unscaled prices', () => {
  const t = {
    ...token('USDT.ETH', 'ETH', 'ETH-USDT-0XABC'),
    name: 'Tether USD',
    iconUrl: 'https://example.com/usdt.png',
    price: { current: '1.00000000000001' },
    variants: { layer1: { identifier: 'ETH.USDT-0XABC', decimals: 6 }, secured: { identifier: 'ETH-USDT-0XABC', decimals: 8 } }
  }
  const asset = toAnalyticsAsset(t)
  assert.equal(asset.identifier, t.id)
  assert.equal(asset.ticker, 'USDT')
  assert.equal(asset.usdPrice, '1.00000000000001')
  assert.equal(asset.name, t.name)
  assert.equal(asset.logoURI, t.iconUrl)
  assert.equal(asset.isSecuredAsset, true)
  assert.equal(toAnalyticsAsset(t, true).decimals, 6)
  assert.equal(toAnalyticsAsset(t, true).marketId, t.id)
  assert.equal(toAnalyticsAsset({ ...t, price: { current: '0' } }).usdPrice, '0')
  assert.equal(toAnalyticsAsset({ ...t, price: null }).usdPrice, null)
})

test('lending preserves decimal supply APR, zero, null and distinct network variants', () => {
  const rows = lendingEarnMarkets([
    { id: 'eth-usdt', token: token('USDT.ETH'), apr: '0.04000000000000000000001' },
    { id: 'tron-usdt', token: token('USDT.TRON', 'TRON'), apr: '0' },
    { id: 'sol', token: token('SOL', 'SOL'), apr: null }
  ])
  assert.equal(rows.assets.length, 3)
  assert.deepEqual(
    rows.opportunities.map(r => r.apr),
    ['0.04000000000000000000001', '0', null]
  )
})

test('staking gets pool identities and 30-day APR from v2, including zero and null', () => {
  const rows = stakingEarnMarkets({
    ruji: pool('ruji', token('RUJI', 'THOR'), null),
    tcy: pool('tcy', token('TCY', 'THOR'), '0'),
    brune: pool('brune', token('bRUNE', 'THOR', 'x/brune'), '0.09')
  })
  assert.deepEqual(
    topEarnOpportunities(rows.opportunities).map(r => r.id),
    ['brune', 'tcy', 'ruji']
  )
  assert.equal(rows.opportunities[0].apr, null)
  assert.deepEqual(stakingEarnMarkets(null), { assets: [], opportunities: [] })
  assert.deepEqual(stakingEarnMarkets({ ruji: null, tcy: { pool: null, current: null } }), { assets: [], opportunities: [] })
})

const createEarnClient = responses => {
  const requests = []
  const { fetchEarnMarkets } = loadRujiraModule('earn-client', {
    './client': {
      paginateAnalytics,
      requestAnalytics: async (query, variables) => {
        requests.push({ query, variables })
        const queue = typeof responses === 'function' ? responses(query) : responses
        assert.ok(queue.length, 'an upstream response was expected')
        return queue.shift()
      }
    }
  })
  return { client: { fetchEarnMarkets }, requests }
}

test('automated loads all v2 Trade and CCL/DCL winner pages without a Main catalogue', async () => {
  const btc = token('BTC', 'BTC'),
    usdc = token('USDC')
  const trade = [
    products({ trade: { pairs: page([pair('no-ccl', token('ETH'), usdc)], true, 'next-trade') } }),
    products({ trade: { pairs: page([pair('btc', btc, usdc)]) } })
  ]
  const ccl = [
    products({ amm: { strategies: page([metric('unknown', '1')], true, 'next-ccl') } }),
    products({ amm: { strategies: page([metric('btc', null)]) } })
  ]
  const { client, requests } = createEarnClient(query => (query === EARN_TRADE_QUERY ? trade : ccl))
  const rows = await client.fetchEarnMarkets('automated')
  assert.deepEqual(
    rows.opportunities.map(r => r.id),
    ['btc']
  )
  assert.equal(rows.opportunities[0].apr, null)
  assert.equal(rows.assets.length, 3)
  assert.equal(requests.length, 4)
  assert.equal(await client.fetchEarnMarkets('automated'), rows)
})

test('lending loads every v2 page and caches null and zero as successful data', async () => {
  const { client, requests } = createEarnClient([
    products({ moneyMarket: { markets: page([{ id: 'zero', token: token('BTC', 'BTC'), apr: '0' }], true, 'next') } }),
    products({ moneyMarket: { markets: page([{ id: 'missing', token: token('SOL', 'SOL'), apr: null }]) } })
  ])
  const rows = await client.fetchEarnMarkets('lending')
  assert.equal(rows.opportunities.length, 2)
  assert.equal(rows.metricsUnavailable, undefined)
  assert.equal(await client.fetchEarnMarkets('lending'), rows)
  assert.equal(requests.length, 2)
  assert.ok(requests.every(r => r.query === EARN_LENDING_QUERY))
  assert.equal(requests[1].variables.after, 'next')
})

test('staking uses one v2 request and caches null averages without a missing-rates error', async () => {
  const { client, requests } = createEarnClient([{ analytics: { ruji: pool('ruji', token('RUJI', 'THOR'), null), brune: null, tcy: null } }])
  const rows = await client.fetchEarnMarkets('staking')
  assert.equal(rows.opportunities[0].apr, null)
  assert.equal(rows.metricsUnavailable, undefined)
  assert.equal(await client.fetchEarnMarkets('staking'), rows)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].query, EARN_STAKING_QUERY)
})

test('null v2 namespaces are successful empty catalogues in every mode', async () => {
  for (const mode of ['automated', 'lending', 'staking']) {
    const { client } = createEarnClient([{ analytics: null }, { analytics: null }])
    const rows = await client.fetchEarnMarkets(mode)
    assert.deepEqual(rows.assets, [])
    assert.deepEqual(rows.opportunities, [])
    assert.notEqual(rows.metricsUnavailable, true)
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
  test(`${mode} accepts null and zero APRs on refresh without a query error`, async () => {
    const original = { assets: [], opportunities: [{ id: 'original', assets: [], apr: '0.1' }] }
    const updated = {
      assets: [],
      opportunities: [
        { id: 'missing', assets: [], apr: null },
        { id: 'zero', assets: [], apr: '0' }
      ]
    }
    const query = createEarnQuery(mode, [Response.json(original), Response.json(updated)])
    await query.fetch()
    assert.deepEqual(await query.fetch(), updated)
    assert.equal(query.client.getQueryState(query.options.queryKey).status, 'success')
    query.client.clear()
  })

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
