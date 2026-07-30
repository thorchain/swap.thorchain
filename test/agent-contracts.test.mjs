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
    assert.match(card.response.headers.get('content-type') || '', /^application\/json/i)
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
    ['/.well-known/openapi.json', /^application\/vnd\.oai\.openapi\+json/],
    ['/.well-known/api-catalog', /^application\/linkset\+json/],
    ['/.well-known/agent-skills/index.json', /^application\/json/]
  ])
  for (const [path, contentType] of expected) {
    const { response } = await request(path)
    assert.equal(response.status, 200, `${path} should resolve`)
    assert.match(response.headers.get('content-type') || '', contentType, `${path} content type mismatch`)
  }
}

const tests = [
  testUnavailableOAuthIsAbsent,
  testOpenApiIsAnonymousAndTruthful,
  testApiCatalogConformsToRfc9727,
  testMcpServerCardAliasesAndAgreement,
  testMcpToolsAreExplicitlySafeAndCallable,
  testDiscoveryDocsAreTruthful,
  testMcpInitializeAndDiscoveryContentTypes
]

let failed = 0
for (const test of tests) {
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
console.log(`agent_contract_tests=ok tests=${tests.length}`)
