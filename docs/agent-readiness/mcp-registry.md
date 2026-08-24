# Publishing the MCP server to the official registry

The MCP server at `https://swap.thorchain.org/mcp` works today — any client that is handed the URL can use it. What it is not yet is **discoverable**:
it is absent from the official MCP Registry (`registry.modelcontextprotocol.io`), which is what Claude, VS Code, the GitHub MCP registry, and the
downstream aggregators read when a user searches for a server by name.

Publishing is metadata-only (the registry hosts no artifacts) and needs one deploy plus one CLI run.

## What is already in the repo

- `server.json` (repo root) — the registry record: name `org.thorchain.swap/thorchain-swap`, a `remotes` entry of type `streamable-http` pointing at
  `https://swap.thorchain.org/mcp`, `websiteUrl`, and `repository`. Keep `version` in step with `MCP_SERVER_INFO.version` in
  `src/lib/agent/mcp-tools.ts`.
- `src/app/.well-known/mcp-registry-auth/route.ts` — serves the domain-ownership proof from the `MCP_REGISTRY_AUTH` environment variable, and 404s
  when it is unset.

## Why HTTP authentication

The registry ties a namespace to proven ownership. GitHub auth would force the name `io.github.thorchain/*`; domain auth gives the reverse-DNS name of
a domain you control. Of the two domain methods, **HTTP** needs nothing outside this deployment — we already serve `/.well-known/` on
swap.thorchain.org — while DNS needs a TXT record on the zone.

Verifying `swap.thorchain.org` yields the namespace `org.thorchain.swap/*`, which is what `server.json` uses. If someone with DNS access to
`thorchain.org` would rather claim the shorter `org.thorchain/*`, use DNS authentication on that zone instead and rename the server in `server.json`
to `org.thorchain/swap` — the two are mutually exclusive, so pick before the first publish (renaming later means republishing under a new name).

## Steps

1. **Generate a key pair** (keep `key.pem` secret — anyone holding it can publish under the namespace):

   ```bash
   openssl genpkey -algorithm Ed25519 -out key.pem
   PUBLIC_KEY="$(openssl pkey -in key.pem -pubout -outform DER | tail -c 32 | base64)"
   echo "v=MCPv1; k=ed25519; p=${PUBLIC_KEY}"
   ```

2. **Publish the proof.** Set that whole line as `MCP_REGISTRY_AUTH` in the production environment and deploy. Verify:

   ```bash
   curl https://swap.thorchain.org/.well-known/mcp-registry-auth
   ```

3. **Install the publisher:**

   ```bash
   brew install mcp-publisher   # or the release binary from github.com/modelcontextprotocol/registry
   ```

4. **Log in and publish** from the repo root (where `server.json` lives):

   ```bash
   PRIVATE_KEY="$(openssl pkey -in key.pem -noout -text | grep -A3 "priv:" | tail -n +2 | tr -d ' :\n')"
   mcp-publisher login http --domain swap.thorchain.org --private-key "${PRIVATE_KEY}"
   mcp-publisher publish
   ```

5. **Confirm the listing:**

   ```bash
   curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=thorchain"
   ```

## Afterwards

- Bump `version` in `server.json` and re-run `mcp-publisher publish` whenever the tool surface changes; the registry keeps version records.
- Publishing can be automated from CI — see the registry's GitHub Actions guide — but that means putting the private key in repository secrets, so a
  manual run per release is a reasonable trade for a server that changes rarely.
- The registry is the upstream that subregistries mirror, so one publish covers most client-side discovery. Directory listings that are editorial
  rather than automated (the ChatGPT app directory, for example) remain separate submissions.

Source: https://modelcontextprotocol.io/registry/remote-servers and https://modelcontextprotocol.io/registry/authentication
