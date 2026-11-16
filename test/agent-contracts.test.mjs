#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import https from 'node:https'

const BASE_URL = (process.env.BASE_URL || 'https://swap.thorchain.org').replace(/\/$/, '')
const CANONICAL_ORIGIN = (process.env.CANONICAL_ORIGIN || 'https://swap.thorchain.org').replace(/\/$/, '')
const timeoutMs = Number(process.env.HTTP_TIMEOUT_MS || 20_000)
const hostHeader = process.env.HOST_HEADER
const CORE_ENDPOINT = 'https://mcp.thorchain.org/mcp'
const CORE_CARD = 'https://mcp.thorchain.org/.well-known/mcp/server-card.json'
const CORE_REGISTRY = 'org.thorchain/thorchain-mcp'
const CARD_PATHS = [
  '/.well-known/mcp/server-card.json',
  '/.well-known/mcp-server-card.json',
  '/.well-known/mcp-server-card',
  '/.well-known/mcp.json',
  '/.well-known/mcp/manifest.json',
  '/mcp.json'
]
let rpcId = 0

/**
 * Node's fetch drops a Host header — the Fetch spec forbids setting it — so a
 * run against a local server could never reach the host-gated routes. node:http
 * has no such restriction, and is used only when HOST_HEADER asks for one.
 */
function requestWithHost(url, { method = 'GET', headers, body }) {
  const target = new URL(url)
  const client = target.protocol === 'https:' ? https : http

  return new Promise((resolve, reject) => {
    const req = client.request(target, { method, headers }, res => {
      const collected = new Headers()
      for (const [name, value] of Object.entries(res.headers)) {
        for (const entry of Array.isArray(value) ? value : [value]) collected.append(name, entry)
      }
      let text = ''
      res.setEncoding('utf8')
      res.on('data', chunk => (text += chunk))
      res.on('end', () => resolve({ response: { status: res.statusCode, headers: collected }, body: text }))
    })
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timed out after ${timeoutMs}ms: ${url}`)))
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function request(path, init = {}) {
  const { headers: initHeaders, ...requestInit } = init
  const headers = { 'User-Agent': 'swap-thorchain-agent-contract-test/1.0', ...(initHeaders || {}) }

  const url = path.startsWith('https://') || path.startsWith('http://') ? path : `${BASE_URL}${path}`
  if (hostHeader && new URL(url).origin === new URL(BASE_URL).origin)
    return requestWithHost(url, { ...requestInit, headers: { ...headers, Host: hostHeader } })

  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
    ...requestInit,
    headers
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
  const id = ++rpcId
  const result = await followMcpRedirect('/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  })
  assert.equal(result.response.status, 200, `MCP ${method}: HTTP ${result.response.status}: ${result.body.slice(0, 200)}`)
  const value = parseRpcResponse(result.body, id)
  return { ...result, value }
}

async function followMcpRedirect(path, init) {
  const redirected = await request(path, init)
  assert.equal(redirected.response.status, 308, `${path} must preserve the HTTP method with 308`)
  assert.equal(redirected.response.headers.get('location'), CORE_ENDPOINT)
  // Deliberately reuse the method/body/Accept while dropping the local Host
  // override. Do not forward credentials or localhost Host to the core host.
  return request(CORE_ENDPOINT, init)
}

function parseRpcResponse(body, id) {
  const text = body.trim()
  if (text.startsWith('{') || text.startsWith('[')) return JSON.parse(text)
  const messages = text.split(/\r?\n\r?\n/).flatMap(event => {
    const data = event
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart())
      .join('\n')
    return data ? [JSON.parse(data)] : []
  })
  const message = messages.find(message => message.id === id)
  assert.ok(message, `SSE must carry the JSON-RPC response for id=${id}`)
  return message
}

// The MCP server needs no credential, so no document may point a client at an
// authorization endpoint. Prose that names a well-known OAuth path to say it is
// deliberately absent is fine; a link a client would follow is not.
function assertNoOAuthEndpointAdvertised(text, label) {
  for (const forbidden of ['/oauth/register', '/oauth/token', '/oauth/authorize', '/agent-auth/authorize', '/agent-auth/token']) {
    assert.equal(text.includes(forbidden), false, `${label} must not advertise ${forbidden}, which does not exist`)
  }

  // `/.well-known/oauth-*` may be named in prose but never linked: a linked
  // path reads as published metadata and starts the sign-in flow that broke
  // connector onboarding (docs/agent-readiness/orank.md).
  for (const link of [
    `](${CANONICAL_ORIGIN}/.well-known/oauth-`,
    '](/.well-known/oauth-',
    'href="/.well-known/oauth-',
    `href="${CANONICAL_ORIGIN}/.well-known/oauth-`
  ]) {
    assert.equal(text.includes(link), false, `${label} must not link an authorization document (${link}); the paths deliberately 404`)
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
  assert.ok(body.includes('rel="ard"') && body.includes('/.well-known/ard.json'), 'homepage should advertise the canonical ARD catalog')
  assert.match(response.headers.get('link') || '', /<\/\.well-known\/ard\.json>; rel="ard"/)
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

/**
 * Regression: an MCP connector treats the presence of protected-resource
 * metadata as "this server requires OAuth" and starts a dynamic client
 * registration it cannot finish here — there is no account to sign in to. The
 * server is anonymous, so every authorization surface must stay absent and the
 * endpoint must answer an unauthenticated call.
 */
async function testNoAuthorizationSurfaceBlocksConnectors() {
  for (const path of [
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/mcp',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-authorization-server/mcp',
    '/.well-known/openid-configuration',
    '/.well-known/jwks.json'
  ]) {
    const { response } = await request(path)
    assert.equal(response.status, 404, `${path} must be absent so clients connect anonymously, got HTTP ${response.status}`)
  }

  // Dynamic client registration must not exist at all, in either shape a
  // connector would try.
  for (const path of ['/oauth/register', '/agent-auth/register', '/register']) {
    const { response } = await request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'connector',
        redirect_uris: ['https://example.com/callback'],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code']
      })
    })
    assert.equal(response.status, 404, `${path} must be absent, got HTTP ${response.status}`)
  }

  // An anonymous call works, and a call carrying a stray token is not rejected:
  // no 401 means no client is ever pushed into a sign-in flow.
  const anonymous = await mcp('tools/list')
  assert.ok(anonymous.value.result?.tools?.length > 0, 'anonymous tools/list must work')

  const withStrayToken = await followMcpRedirect('/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer leftover-token' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/list' })
  })
  assert.equal(withStrayToken.response.status, 200, 'a stray Authorization header must not trigger an auth challenge')
  assert.equal(withStrayToken.response.headers.get('www-authenticate'), null, 'the server must never send an auth challenge')

  const card = (await json('/.well-known/mcp/server-card.json')).value
  assert.equal(card.authentication?.required, false)
  assert.equal(card.authentication?.optional, undefined, 'the server card must not advertise an optional auth flow')

  // The docs must tell a human what to do when a connector asks for a client ID.
  const authDoc = await request('/developers/auth.md')
  assert.equal(authDoc.response.status, 200)
  assert.ok(
    authDoc.body.includes('leave it blank') || authDoc.body.includes('leave the field blank'),
    'auth docs should say to leave connector credential fields blank'
  )
  assert.ok(
    authDoc.body.includes('https://affiliate.thorchain.org'),
    '/developers/auth.md should point aggregator-key seekers at the affiliate program'
  )
}

async function testDeveloperResourcesArePublishedByName() {
  const topics = new Map([
    ['quickstart', 'THORChain Swap API Quickstart'],
    ['api', 'THORChain Swap REST API Reference'],
    ['mcp', 'THORChain Swap MCP Server'],
    ['auth', 'THORChain Swap API Authentication'],
    ['sdks', 'THORChain Swap SDKs'],
    ['webhooks', 'THORChain Swap Webhooks and Event Polling']
  ])

  for (const [slug, heading] of topics) {
    const page = await request(`/developers/${slug}`)
    assert.equal(page.response.status, 200, `/developers/${slug} should return HTTP 200`)
    assertCanonical(page.body, `/developers/${slug}`)
    assert.ok(page.body.includes('THORChain Swap'), `/developers/${slug} should carry the product name`)
    assert.ok(page.body.includes(heading), `/developers/${slug} should render its heading`)
    assert.ok(page.body.includes('<title>'), `/developers/${slug} needs a title`)

    const markdown = await request(`/developers/${slug}.md`)
    assert.equal(markdown.response.status, 200, `/developers/${slug}.md should return HTTP 200`)
    assert.match(markdown.response.headers.get('content-type') || '', /^text\/markdown/)
    assert.ok(markdown.body.startsWith(`# ${heading}`), `/developers/${slug}.md should start with its H1`)
  }

  // The portal and llms.txt must name every topic so a by-name search finds it.
  const portal = await request('/developers')
  const llms = await request('/llms.txt')
  for (const slug of topics.keys()) {
    assert.ok(portal.body.includes(`/developers/${slug}`), `developer portal should link /developers/${slug}`)
    assert.ok(llms.body.includes(`/developers/${slug}`), `llms.txt should list /developers/${slug}`)
  }

  for (const [alias, target] of [
    ['/docs', '/developers'],
    ['/api-docs', '/developers/api'],
    ['/sdk', '/developers/sdks']
  ]) {
    const { response } = await request(alias)
    assert.ok([301, 302, 307, 308].includes(response.status), `${alias} should redirect, got ${response.status}`)
    assert.ok(
      (response.headers.get('location') || '').endsWith(target),
      `${alias} should redirect to ${target}, got ${response.headers.get('location')}`
    )
  }
}

async function testSdkPackagesArePublishedAndPointHome() {
  const { body } = await request('/developers/sdks.md')
  for (const packageName of ['@tcswap/sdk', 'thorchain-swap', 'github.com/thorchain/swap.thorchain/sdk/go']) {
    assert.ok(body.includes(packageName), `SDK page should name ${packageName}`)
  }
  for (const ecosystem of ['npm', 'PyPI', 'Go modules']) {
    assert.ok(body.includes(ecosystem), `SDK page should name the ${ecosystem} ecosystem`)
  }
}

async function testArdCatalogEnumeratesTruthfulResources() {
  const { response, value: catalog } = await json('/.well-known/ai-catalog.json')
  assert.match(response.headers.get('content-type') || '', /^application\/json/i)
  assert.equal(catalog.specVersion, '1.0')
  const canonical = await json('/.well-known/ard.json')
  assert.deepEqual(canonical.value, catalog, 'canonical ARD and legacy AI Catalog must describe the same resources')
  assert.equal(catalog.host?.displayName, 'THORChain Swap')
  assert.ok(Array.isArray(catalog.entries) && catalog.entries.length >= 5, 'ARD catalog should enumerate the primary agent resources')

  const expectedMediaTypes = new Map([
    [`${CANONICAL_ORIGIN}/.well-known/mcp/server-card.json`, 'application/mcp-server-card+json'],
    [`${CANONICAL_ORIGIN}/.well-known/openapi.json`, 'application/vnd.oai.openapi+json'],
    [`${CANONICAL_ORIGIN}/.well-known/api-catalog`, 'application/linkset+json'],
    [`${CANONICAL_ORIGIN}/.well-known/agent-card.json`, 'application/a2a-agent-card+json'],
    [`${CANONICAL_ORIGIN}/.well-known/agent-skills/index.json`, 'application/json']
  ])

  const assertTrustManifest = (manifest, label) => {
    assert.ok(manifest, `${label} needs a trustManifest`)
    assert.equal(manifest.assurance, 'self-attested', `${label} must label its assurance level`)
    assert.equal(manifest.identity?.domain, 'swap.thorchain.org', `${label} trustManifest needs a domain identity`)
    assert.equal(manifest.identity?.canonicalUrl, CANONICAL_ORIGIN)
    assert.ok(Array.isArray(manifest.attestations) && manifest.attestations.length > 0, `${label} needs attestations`)
    for (const attestation of manifest.attestations) {
      assert.equal(attestation.type, 'self-attested', `${label} must not claim a stronger attestation type`)
      assert.equal(typeof attestation.claim, 'string')
    }
    assert.equal(manifest.signature, null, `${label} must not claim a signature it does not produce`)
  }

  assertTrustManifest(catalog.host?.trustManifest, 'ARD host')

  const identifiers = new Set()
  for (const entry of catalog.entries) {
    assert.match(entry.identifier || '', /^urn:air:swap\.thorchain\.org:/)
    assert.equal(identifiers.has(entry.identifier), false, `duplicate ARD identifier ${entry.identifier}`)
    identifiers.add(entry.identifier)
    assert.equal(typeof entry.displayName, 'string')
    assertTrustManifest(entry.trustManifest, entry.identifier)
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
      for (const [status, response] of Object.entries(operation.responses || {})) {
        if (status.startsWith('2')) {
          assert.ok(response.content?.['application/json']?.schema, `${method.toUpperCase()} ${path} success responses need JSON schemas`)
        }
      }
    }
  }
  assert.ok(operations.length >= 2, 'OpenAPI should expose its public operations')
  assertNoOAuthEndpointAdvertised(body, 'OpenAPI')
  const status = (await json('/.well-known/status')).value
  const statusSchema = openapi.components.schemas.DiscoveryStatus
  for (const key of statusSchema.required) assert.ok(key in status, `live discovery status must include ${key}`)
  assert.equal(status.status, statusSchema.properties.status.const)
  assert.equal(status.service, statusSchema.properties.service.const)
  assert.equal(status.url, CANONICAL_ORIGIN)
}

async function testDeveloperSectionIndex() {
  const root = await request('/llms.txt')
  assert.ok(root.body.includes(`${CANONICAL_ORIGIN}/developers/llms.txt`), 'root index must link the focused developer index')
  const index = await request('/developers/llms.txt')
  assert.equal(index.response.status, 200)
  assert.match(index.response.headers.get('content-type') || '', /^text\/markdown/)
  for (const slug of ['quickstart', 'api', 'mcp', 'auth', 'sdks', 'webhooks']) {
    assert.ok(index.body.includes(`/developers/${slug}.md`), `developer index must link ${slug}`)
    assert.equal((await request(`/developers/${slug}.md`)).response.status, 200)
  }
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
  const upstream = (await json(CORE_CARD)).value
  const tools = (await mcp('tools/list')).value.result?.tools
  assert.ok(Array.isArray(tools) && tools.length > 3, 'the core tool surface must replace the retired three-tool server')
  for (const path of CARD_PATHS) {
    const { response, value: card } = await json(path)
    assert.match(response.headers.get('content-type') || '', /^application\/mcp-server-card\+json/i)
    assert.equal(card.name, 'thorchain-mcp')
    assert.equal(card.title, 'THORChain MCP')
    assert.equal(card.serverUrl, CORE_ENDPOINT)
    assert.equal(card.transport?.endpoint, CORE_ENDPOINT)
    assert.equal(card.transport?.type, 'streamable-http')
    assert.equal(card.registry?.name, CORE_REGISTRY)
    assert.deepEqual(card.tools, upstream.tools, 'local mirror must preserve the full core schemas and annotations')
    assert.deepEqual(card.capabilities, upstream.capabilities)
    assert.deepEqual(card.serverInfo, upstream.serverInfo)
    assert.equal(card.version, upstream.version)
    assert.equal(card.protocolVersion, upstream.protocolVersion)
    assert.deepEqual(card.resources, upstream.resources, 'never advertise the retired swap quote App')
    assert.equal(card.authentication?.required, false)
    assert.deepEqual(card.tools.map(tool => tool.name).sort(), tools.map(tool => tool.name).sort(), 'live core card and tools/list must agree')
    assert.equal(card.icons?.[0]?.src, card.icon)
    const icon = await request(card.icon.startsWith(CANONICAL_ORIGIN) ? card.icon.slice(CANONICAL_ORIGIN.length) : card.icon)
    assert.equal(icon.response.status, 200, 'the preserved SVG branding must be reachable')
    assert.match(icon.response.headers.get('content-type') || '', /^image\//)
    const head = await request(path, { method: 'HEAD' })
    assert.equal(head.response.status, 200)
    assert.equal(head.body, '')
  }
  const agents = (await json('/agents.json')).value
  const mode = (await json('/?mode=agent', { headers: { Accept: 'application/json' } })).value
  for (const advertised of [agents.mcp, mode.endpoints.mcp]) {
    assert.equal(advertised.transport?.endpoint || advertised.url, CORE_ENDPOINT)
    assert.equal(advertised.registry.name, CORE_REGISTRY)
    for (const tool of advertised.tools) {
      const core = tools.find(core => core.name === tool.name)
      assert.ok(core, `unknown advertised tool ${tool.name}`)
      assert.deepEqual(Object.keys(tool.inputSchema.properties || {}).sort(), Object.keys(core.inputSchema.properties || {}).sort())
      assert.deepEqual(tool.inputSchema.required || [], core.inputSchema.required || [])
      assert.equal(tool.inputSchema.additionalProperties, core.inputSchema.additionalProperties)
      for (const [name, property] of Object.entries(tool.inputSchema.properties || {})) {
        assert.equal(property.type, core.inputSchema.properties[name].type, `${tool.name}.${name} must match core`)
      }
    }
  }
}

async function testMcpManifestIsReachableFromEveryStandardPath() {
  for (const path of ['/mcp', '/.well-known/mcp', ...CARD_PATHS]) {
    const id = ++rpcId
    const handshake = await followMcpRedirect(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'swap-redirect-contract', version: '1.0' }
        }
      })
    })
    assert.equal(handshake.response.status, 200, `POST ${path} should reach the canonical core server`)
    assert.equal(parseRpcResponse(handshake.body, id).result?.serverInfo?.name, 'thorchain-mcp')
    const options = await request(path, { method: 'OPTIONS' })
    assert.equal(options.response.status, 308, `OPTIONS ${path} must reach the same service`)
    assert.equal(options.response.headers.get('location'), CORE_ENDPOINT)
  }
  for (const path of ['/mcp', '/.well-known/mcp']) {
    const get = await request(path)
    assert.equal(get.response.status, 308)
    assert.equal(get.response.headers.get('location'), CORE_ENDPOINT)
  }
  const get = await request(CORE_ENDPOINT, { headers: { Accept: 'text/event-stream' } })
  assert.equal(get.response.status, 405, 'the canonical transport does not serve a card on GET')
}

async function testMcpToolsAreExplicitlySafeAndCallable() {
  const tools = (await mcp('tools/list')).value.result?.tools
  const byName = new Map(tools.map(tool => [tool.name, tool]))
  assert.ok(!byName.has('get_swap_quote') && !byName.has('get_network_status'), 'do not relabel legacy tools as the core contract')
  const quote = byName.get('quote_swap')
  assert.deepEqual(quote.inputSchema.required, ['from_asset', 'to_asset', 'amount'])
  assert.equal(quote.inputSchema.properties.amount.type, 'integer')
  assert.equal(quote.inputSchema.properties.streaming_interval, undefined)
  assert.deepEqual(Object.keys(byName.get('list_pools').inputSchema.properties).sort(), ['limit', 'offset'])
  assert.ok(byName.has('get_network_summary'))
  const pools = (await mcp('tools/call', { name: 'list_pools', arguments: { limit: 3, offset: 0 } })).value
  assert.equal(pools.error, undefined)
  assert.ok(!pools.result.isError, JSON.stringify(pools.result))
  const data = pools.result.structuredContent?.data
  assert.ok(Array.isArray(data) && data.length <= 3, 'core pool pagination must match the documented parameters')
  const network = (await mcp('tools/call', { name: 'get_network_summary', arguments: {} })).value
  assert.equal(network.error, undefined)
  assert.ok(!network.result.isError, JSON.stringify(network.result))
  assert.equal(typeof network.result.structuredContent?.data, 'object')
  for (const name of ['quote_swap', 'list_pools', 'get_network_summary']) {
    assert.equal(byName.get(name).annotations?.readOnlyHint, true)
  }
  // Every JSON example in the actual guide must use a real core tool and the
  // correct input types; tool-list/schema tests alone missed the old examples.
  for (const path of ['/developers/quickstart.md', '/developers/mcp.md', '/developers.md', '/llms-full.md', '/AGENTS.md']) {
    const { body } = await request(path)
    assert.ok(body.includes(CORE_ENDPOINT), `${path} must use the canonical endpoint`)
    assert.equal(body.includes('"name": "get_swap_quote"'), false, `${path} must not teach the retired tool`)
    assert.equal(body.includes('ui://thorchain-swap/swap-quote'), false, `${path} must not advertise an unsupported MCP App`)
    assert.equal(body.includes('org.thorchain.swap/thorchain-swap'), false, `${path} must not promote the retired Registry entry`)
  }
}

// The server offers to negotiate 2025-03-26 and 2024-11-05, revisions where a
// JSON-RPC batch is a valid request, so a batch must work rather than fail the
// whole call.
async function testMcpClientCompatibility() {
  // Fetch follows 308 automatically; this covers a real client rather than
  // only inspecting a Location header. Core SSE decoding is mandatory.
  const id = ++rpcId
  const response = await fetch(`${BASE_URL}/mcp`, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'fetch-redirect-client', version: '1.0' }
      }
    })
  })
  assert.equal(response.status, 200)
  assert.equal(response.url, CORE_ENDPOINT)
  assert.match(response.headers.get('content-type') || '', /^text\/event-stream|^application\/json/)
  assert.equal(parseRpcResponse(await response.text(), id).result?.serverInfo?.name, 'thorchain-mcp')
  const doc = await request('/developers/mcp.md')
  assert.ok(doc.body.includes('text/event-stream'), 'the guide must teach the Accept/SSE requirement')
  assert.match(doc.body, /CORS/i, 'the guide must disclose the upstream browser limitation')
  // We do not retain the old server\'s JSON-only or batch guarantees: protocol
  // support belongs to core and is discovered with initialize.
}

// The registry record is published by hand, so a tool-surface bump that forgets
// server.json would list a version the server no longer runs.
async function testRegistryRecordMatchesCanonicalServer() {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const record = JSON.parse(readFileSync(`${root}server.json`, 'utf8'))
  const published = (await json('https://registry.modelcontextprotocol.io/v0.1/servers/org.thorchain%2Fthorchain-mcp/versions/latest')).value.server
  assert.equal(record.name, CORE_REGISTRY)
  assert.equal(record.name, published.name)
  // The local reference is a published version, not a pin on the deployment.
  // A subsequent core release must not break an otherwise valid UI build.
  const reference = (
    await json(`https://registry.modelcontextprotocol.io/v0.1/servers/org.thorchain%2Fthorchain-mcp/versions/${encodeURIComponent(record.version)}`)
  ).value.server
  assert.equal(record.version, reference.version)
  assert.equal(record.name, reference.name)
  assert.deepEqual(record.remotes, published.remotes)
  assert.equal(record.repository.url, 'https://gitlab.com/thorchain/thorchain-mcp')
}

async function testDiscoveryDocsAreTruthful() {
  const linked = new Set()
  for (const path of ['/auth.md', '/developers.md', '/llms-full.md', '/llms.txt', '/AGENTS.md']) {
    const { response, body } = await request(path)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') || '', /^text\/markdown/)
    assertNoOAuthEndpointAdvertised(body, path)
    for (const [, url] of body.matchAll(/\]\((https:\/\/swap\.thorchain\.org[^)\s]*)\)/g)) linked.add(url)
  }

  // Nothing is advertised unless it is implemented: every own-origin URL these
  // documents link must resolve.
  for (const url of linked) {
    const { response } = await request(url.replace(CANONICAL_ORIGIN, ''))
    assert.ok(response.status < 400, `discovery documents link ${url}, which returns HTTP ${response.status}`)
  }

  const agentMode = await request('/?mode=agent', { headers: { Accept: 'application/json' } })
  assert.equal(agentMode.response.status, 200)
  JSON.parse(agentMode.body)
  assertNoOAuthEndpointAdvertised(agentMode.body, 'agent mode')
}

async function testMcpInitializeAndDiscoveryContentTypes() {
  const init = await mcp('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'contract-test', version: '1.0' }
  })
  assert.equal(init.value.result?.protocolVersion, '2025-06-18')
  assert.equal(init.value.result?.serverInfo?.name, 'thorchain-mcp')

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
    ['/.well-known/agent-skills/index.json', /^application\/json/],
    ['/.well-known/mcp.json', /^application\/mcp-server-card\+json/],
    ['/developers/quickstart.md', /^text\/markdown/],
    ['/developers/mcp.md', /^text\/markdown/]
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
  testNoAuthorizationSurfaceBlocksConnectors,
  testDeveloperResourcesArePublishedByName,
  testSdkPackagesArePublishedAndPointHome,
  testArdCatalogEnumeratesTruthfulResources,
  testOpenApiIsAnonymousAndTruthful,
  testDeveloperSectionIndex,
  testApiCatalogConformsToRfc9727,
  testMcpServerCardAliasesAndAgreement,
  testMcpManifestIsReachableFromEveryStandardPath,
  testMcpToolsAreExplicitlySafeAndCallable,
  testMcpClientCompatibility,
  testRegistryRecordMatchesCanonicalServer,
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
