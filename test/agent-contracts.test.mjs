#!/usr/bin/env node
import assert from 'node:assert/strict'

const BASE_URL = (process.env.BASE_URL || 'https://swap.thorchain.org').replace(/\/$/, '')
const CANONICAL_ORIGIN = (process.env.CANONICAL_ORIGIN || 'https://swap.thorchain.org').replace(/\/$/, '')
const timeoutMs = Number(process.env.HTTP_TIMEOUT_MS || 20_000)
const hostHeader = process.env.HOST_HEADER
let rpcId = 0

async function request(path, init = {}) {
  const { headers: initHeaders, ...requestInit } = init
  const response = await fetch(`${BASE_URL}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
    ...requestInit,
    headers: {
      'User-Agent': 'swap-thorchain-agent-contract-test/1.0',
      ...(hostHeader ? { Host: hostHeader } : {}),
      ...(initHeaders || {})
    }
  })
  const body = await response.text()
  return { response, body }
}

async function json(path, init = {}) {
  const result = await request(path, init)
  assert.equal(result.response.status, 200, `${path} should return HTTP 200; body=${result.body.slice(0, 300)}`)
  return { ...result, value: JSON.parse(result.body) }
}

async function mcp(method, params = {}) {
  return json('/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params })
  })
}

function assertNoOAuthAdvertisement(text, label) {
  for (const forbidden of [
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource',
    '/agent-auth/authorize',
    '/agent-auth/token',
    'agentOAuth'
  ]) {
    assert.equal(text.includes(forbidden), false, `${label} must not advertise unavailable OAuth surface ${forbidden}`)
  }
}

function parseJsonLd(html) {
  return [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map(match => JSON.parse(match[1]))
}

function assertCanonical(html, path) {
  const canonical = `${CANONICAL_ORIGIN}${path}`
  assert.match(html, new RegExp(`<link[^>]+rel="canonical"[^>]+href="${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
}

async function testHomepageMetadataAndStructure() {
  const { response, body } = await request('/')
  assert.equal(response.status, 200)
  assertCanonical(body, '')

  const graphs = parseJsonLd(body).flatMap(document => document['@graph'] || [document])
  const application = graphs.find(node => node['@type'] === 'WebApplication')
  assert.ok(application, 'homepage needs WebApplication JSON-LD')
  assert.deepEqual(application.isPartOf, { '@id': `${CANONICAL_ORIGIN}/#website` })
  assert.deepEqual(application.publisher, { '@id': `${CANONICAL_ORIGIN}/#organization` })
  assert.ok(application.sameAs?.includes('https://github.com/thorchain/swap.thorchain'))
  assert.deepEqual(application.subjectOf, { '@id': `${CANONICAL_ORIGIN}/developers#webpage` })
  assert.ok(body.includes('rel="ai-catalog"'), 'homepage should advertise the ARD catalog in HTML discovery')
  assert.ok(
    body.includes('rel="mcp-server-card" type="application/mcp-server-card+json"'),
    'homepage should advertise the canonical MCP card with its protocol media type'
  )

  for (const heading of ['How native cross-chain swaps work', 'Self-custody and transaction safety', 'Developer and AI integrations']) {
    assert.ok(body.includes(`<h2>${heading}</h2>`), `homepage should include structured heading: ${heading}`)
  }
}

async function testTrustPagesAreLinkedAndCanonical() {
  const pages = new Map([
    ['/about', 'About THORChain Swap'],
    ['/contact', 'Contact THORChain Swap']
  ])
  for (const [path, heading] of pages) {
    const { response, body } = await request(path)
    assert.equal(response.status, 200, `${path} should return HTTP 200`)
    assertCanonical(body, path)
    assert.ok(body.includes('<main lang="en"'), `${path} should declare its English content language`)
    assert.ok(body.includes(`<h1`), `${path} should have an H1`)
    assert.ok(body.includes(heading), `${path} should identify the page`)
  }

  const contact = await request('/contact')
  assert.ok(contact.body.includes('mailto:contact@thorchain.org'), 'contact page should publish the official support email')

  const home = await request('/')
  assert.ok(home.body.includes('href="/about"'), 'homepage should link to About')
  assert.ok(home.body.includes('href="/contact"'), 'homepage should link to Contact')

  const sitemap = await request('/sitemap.xml')
  assert.equal(sitemap.response.status, 200)
  assert.ok(sitemap.body.includes(`${CANONICAL_ORIGIN}/about`))
  assert.ok(sitemap.body.includes(`${CANONICAL_ORIGIN}/contact`))
}

async function testTrustPagesHaveMarkdownTwins() {
  for (const path of ['/about.md', '/contact.md']) {
    const { response, body } = await request(path)
    assert.equal(response.status, 200, `${path} should return HTTP 200`)
    assert.match(response.headers.get('content-type') || '', /^text\/markdown/)
    assert.match(body, /^# /)
    assert.ok(body.includes(CANONICAL_ORIGIN), `${path} should reference the canonical site`)
  }
}

async function testInitialSwapControlsHaveAccessibleNames() {
  const { response, body } = await request('/')
  assert.equal(response.status, 200)

  for (const label of ['Launch App', 'Swap: Price Protection', 'Select coin: Sell', 'Select coin: Buy', 'Enter Amount']) {
    assert.ok(body.includes(`aria-label="${label}"`), `initial swap HTML should expose accessible name: ${label}`)
  }

  for (const [id, label] of [
    ['swap-sell-amount', 'Sell'],
    ['swap-buy-amount', 'Buy']
  ]) {
    assert.ok(body.includes(`id="${id}"`), `${label} amount input should have a stable id`)
    assert.match(body, new RegExp(`<label[^>]+for="${id}"[^>]*>${label}<\/label>`))
  }
}

async function testUnavailableOAuthIsAbsent() {
  for (const path of [
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource',
    '/.well-known/jwks.json',
    '/agent-auth/authorize'
  ]) {
    const { response } = await request(path)
    assert.equal(response.status, 404, `${path} should be absent, got HTTP ${response.status}`)
  }

  const token = await request('/agent-auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=authorization_code&code=invalid'
  })
  assert.equal(token.response.status, 404, `/agent-auth/token should be absent, got HTTP ${token.response.status}`)
}

async function testArdCatalogEnumeratesTruthfulResources() {
  const { response, value: catalog } = await json('/.well-known/ai-catalog.json')
  assert.match(response.headers.get('content-type') || '', /^application\/json/i)
  assert.equal(catalog.specVersion, '1.0')
  assert.equal(catalog.host?.displayName, 'THORChain Swap')
  assert.ok(Array.isArray(catalog.entries) && catalog.entries.length >= 5, 'ARD catalog should enumerate the primary agent resources')

  const expectedMediaTypes = new Map([
    [`${CANONICAL_ORIGIN}/.well-known/mcp/server-card.json`, 'application/mcp-server-card+json'],
    [`${CANONICAL_ORIGIN}/.well-known/openapi.json`, 'application/vnd.oai.openapi+json'],
    [`${CANONICAL_ORIGIN}/.well-known/api-catalog`, 'application/linkset+json'],
    [`${CANONICAL_ORIGIN}/.well-known/agent-card.json`, 'application/a2a-agent-card+json'],
    [`${CANONICAL_ORIGIN}/.well-known/agent-skills/index.json`, 'application/json']
  ])

  const identifiers = new Set()
  for (const entry of catalog.entries) {
    assert.match(entry.identifier || '', /^urn:air:swap\.thorchain\.org:/)
    assert.equal(identifiers.has(entry.identifier), false, `duplicate ARD identifier ${entry.identifier}`)
    identifiers.add(entry.identifier)
    assert.equal(typeof entry.displayName, 'string')
    assert.equal(entry.type, expectedMediaTypes.get(entry.url), `${entry.identifier} needs the protocol-specific media type`)
    assert.ok(entry.url?.startsWith(`${CANONICAL_ORIGIN}/`), `${entry.identifier} needs a canonical production URL`)
    const advertised = await request(new URL(entry.url).pathname)
    assert.equal(advertised.response.status, 200, `${entry.identifier} URL should resolve`)
    assert.equal(
      advertised.response.headers.get('content-type')?.split(';')[0],
      entry.type,
      `${entry.identifier} catalog type should match the advertised resource`
    )
  }

  const urls = new Set(catalog.entries.map(entry => entry.url))
  for (const path of [
    '/.well-known/mcp/server-card.json',
    '/.well-known/openapi.json',
    '/.well-known/api-catalog',
    '/.well-known/agent-card.json',
    '/.well-known/agent-skills/index.json'
  ]) {
    assert.equal(urls.has(`${CANONICAL_ORIGIN}${path}`), true, `ARD catalog should include ${path}`)
  }
}

async function testOpenApiIsAnonymousAndTruthful() {
  const { value: openapi, body } = await json('/.well-known/openapi.json')
  assert.equal(openapi.openapi, '3.1.0')
  assert.deepEqual(openapi.security, [{}], 'OpenAPI global security should declare anonymous access only')
  const schemes = openapi.components?.securitySchemes || {}
  assert.equal(Object.keys(schemes).length, 0, 'OpenAPI should not publish an unavailable security scheme')

  const operations = []
  for (const [path, pathItem] of Object.entries(openapi.paths || {})) {
    for (const method of ['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace']) {
      const operation = pathItem?.[method]
      if (!operation) continue
      operations.push(`${method.toUpperCase()} ${path}`)
      if (operation.security !== undefined) {
        assert.deepEqual(operation.security, [{}], `${method.toUpperCase()} ${path} must not override anonymous access`)
      }
      for (const response of Object.values(operation.responses || {})) {
        assert.equal(typeof response?.description, 'string', `${method.toUpperCase()} ${path} responses need descriptions`)
      }
    }
  }
  assert.ok(operations.length >= 2, 'OpenAPI should expose its public operations')
  assertNoOAuthAdvertisement(body, 'OpenAPI')
}

async function testApiCatalogConformsToRfc9727() {
  const { response, value: catalog } = await json('/.well-known/api-catalog')
  const contentType = response.headers.get('content-type') || ''
  assert.match(contentType, /^application\/linkset\+json/i)
  assert.match(contentType, /profile="?https:\/\/www\.rfc-editor\.org\/info\/rfc9727"?/i)

  const head = await request('/.well-known/api-catalog', { method: 'HEAD' })
  assert.equal(head.response.status, 200)
  assert.equal(head.body, '')
  assert.match(head.response.headers.get('link') || '', /rel="?api-catalog"?/i)

  assert.ok(Array.isArray(catalog.linkset) && catalog.linkset.length > 0, 'API catalog must contain linkset entries')
  for (const [index, linkset] of catalog.linkset.entries()) {
    assert.equal(linkset.anchor, `${CANONICAL_ORIGIN}/api/v1`, `linkset[${index}] needs the canonical API anchor`)
    assert.ok(Array.isArray(linkset.item) && linkset.item.length > 0, `linkset[${index}] must contain item entries`)
    for (const [itemIndex, item] of linkset.item.entries()) {
      assert.ok(item.href.startsWith(`${CANONICAL_ORIGIN}/api/v1/`), `linkset[${index}].item[${itemIndex}] must use the canonical API origin`)
      assert.equal(item.type, 'application/json')
      assert.equal(typeof item.title, 'string')
    }

    const expectedRelations = {
      'service-desc': '/.well-known/openapi.json',
      'service-doc': '/developers.md',
      status: '/.well-known/status'
    }
    for (const [relation, suffix] of Object.entries(expectedRelations)) {
      const links = linkset[relation]
      assert.ok(Array.isArray(links) && links.length > 0, `linkset[${index}] needs ${relation}`)
      assert.ok(
        links.some(link => link.href === `${CANONICAL_ORIGIN}${suffix}`),
        `${relation} must resolve at the canonical origin`
      )
    }
  }

  for (const path of ['/.well-known/openapi.json', '/developers.md', '/.well-known/status']) {
    const linked = await request(path)
    assert.equal(linked.response.status, 200, `catalog link ${path} must resolve`)
  }
}

async function testMcpServerCardAliasesAndAgreement() {
  const paths = ['/.well-known/mcp/server-card.json', '/.well-known/mcp-server-card.json', '/.well-known/mcp-server-card']
  const cards = []
  for (const path of paths) {
    const card = await json(path)
    const expectedType = path === '/.well-known/mcp/server-card.json' ? /^application\/mcp-server-card\+json/i : /^application\/json/i
    assert.match(card.response.headers.get('content-type') || '', expectedType)
    cards.push(card.value)
  }
  for (const [index, card] of cards.entries()) {
    assert.equal(typeof card.name, 'string', `${paths[index]} needs top-level name`)
    assert.equal(typeof card.description, 'string', `${paths[index]} needs top-level description`)
    assert.equal(typeof card.version, 'string', `${paths[index]} needs top-level version`)
    assert.equal(card.serverUrl, `${CANONICAL_ORIGIN}/mcp`)
    assert.equal(card.transport?.endpoint, `${CANONICAL_ORIGIN}/mcp`)
    assert.equal(card.authentication?.type, 'none')
  }
  for (const card of cards.slice(1)) assert.deepEqual(card, cards[0], 'all MCP server-card aliases must be identical')

  const tools = (await mcp('tools/list')).value.result?.tools
  const resources = (await mcp('resources/list')).value.result?.resources
  assert.deepEqual(cards[0].tools.map(tool => tool.name).sort(), tools.map(tool => tool.name).sort(), 'server-card tools must agree with tools/list')
  assert.deepEqual(
    cards[0].resources.map(resource => resource.uri).sort(),
    resources.map(resource => resource.uri).sort(),
    'server-card resources must agree with resources/list'
  )

  const resource = (await mcp('resources/read', { uri: resources[0].uri })).value
  assert.ok(Array.isArray(resource.result?.contents) && resource.result.contents.length > 0, 'advertised MCP resource must be readable')
}

async function testMcpToolsAreExplicitlySafeAndCallable() {
  const tools = (await mcp('tools/list')).value.result?.tools
  assert.ok(Array.isArray(tools) && tools.length === 3, 'Expected exactly three MCP tools')
  for (const tool of tools) {
    assert.ok(tool.inputSchema && tool.inputSchema.type === 'object', `${tool.name} needs an object input schema`)
    assert.deepEqual(
      tool.annotations,
      { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      `${tool.name} needs explicit read-only behavioral annotations`
    )
  }

  const live = (await mcp('tools/call', { name: 'get_network_status', arguments: {} })).value
  assert.equal(live.error, undefined, `read-only get_network_status should dispatch successfully: ${JSON.stringify(live.error)}`)
  assert.equal(live.result?.isError, undefined, 'get_network_status upstream request should succeed')
  assert.ok(Array.isArray(live.result?.content) && live.result.content[0]?.type === 'text')

  const invalidParams = (await mcp('tools/call', { arguments: {} })).value
  assert.equal(invalidParams.error?.code, -32602)
  const invalidMethod = (await mcp('not/a/method')).value
  assert.equal(invalidMethod.error?.code, -32601)
}

async function testDiscoveryDocsAreTruthful() {
  for (const path of ['/auth.md', '/developers.md', '/llms-full.md']) {
    const { response, body } = await request(path)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') || '', /^text\/markdown/)
    assertNoOAuthAdvertisement(body, path)
  }

  const agentMode = await request('/?mode=agent', { headers: { Accept: 'application/json' } })
  assert.equal(agentMode.response.status, 200)
  JSON.parse(agentMode.body)
  assertNoOAuthAdvertisement(agentMode.body, 'agent mode')
}

async function testMcpInitializeAndDiscoveryContentTypes() {
  const init = await mcp('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'contract-test', version: '1.0' }
  })
  assert.equal(init.value.result?.protocolVersion, '2025-06-18')
  assert.match(init.value.result?.instructions || '', /never holds keys, signs, or submits transactions/i)

  const expected = new Map([
    ['/llms.txt', /^text\/markdown/],
    ['/llms-full.md', /^text\/markdown/],
    ['/AGENTS.md', /^text\/markdown/],
    ['/developers.md', /^text\/markdown/],
    ['/auth.md', /^text\/markdown/],
    ['/about.md', /^text\/markdown/],
    ['/contact.md', /^text\/markdown/],
    ['/.well-known/openapi.json', /^application\/vnd\.oai\.openapi\+json/],
    ['/.well-known/api-catalog', /^application\/linkset\+json/],
    ['/.well-known/agent-card.json', /^application\/a2a-agent-card\+json/],
    ['/.well-known/mcp/server-card.json', /^application\/mcp-server-card\+json/],
    ['/.well-known/ai-catalog.json', /^application\/json/],
    ['/.well-known/agent-skills/index.json', /^application\/json/]
  ])
  for (const [path, contentType] of expected) {
    const { response } = await request(path)
    assert.equal(response.status, 200, `${path} should resolve`)
    assert.match(response.headers.get('content-type') || '', contentType, `${path} content type mismatch`)
  }
}

const tests = [
  testHomepageMetadataAndStructure,
  testTrustPagesAreLinkedAndCanonical,
  testTrustPagesHaveMarkdownTwins,
  testInitialSwapControlsHaveAccessibleNames,
  testUnavailableOAuthIsAbsent,
  testArdCatalogEnumeratesTruthfulResources,
  testOpenApiIsAnonymousAndTruthful,
  testApiCatalogConformsToRfc9727,
  testMcpServerCardAliasesAndAgreement,
  testMcpToolsAreExplicitlySafeAndCallable,
  testDiscoveryDocsAreTruthful,
  testMcpInitializeAndDiscoveryContentTypes
]

const selectedTests = process.env.TEST_FILTER ? tests.filter(test => test.name.includes(process.env.TEST_FILTER)) : tests
assert.ok(selectedTests.length > 0, `No contract tests matched TEST_FILTER=${process.env.TEST_FILTER}`)

let failed = 0
for (const test of selectedTests) {
  try {
    await test()
    console.log(`ok - ${test.name}`)
  } catch (error) {
    failed += 1
    console.error(`not ok - ${test.name}`)
    console.error(error.stack || error)
  }
}
if (failed) {
  console.error(`agent_contract_tests=failed failures=${failed}`)
  process.exit(1)
}
console.log(`agent_contract_tests=ok tests=${selectedTests.length}`)
