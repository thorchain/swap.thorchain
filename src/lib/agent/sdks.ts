import { AppConfig } from '@/config'

const REPO = 'https://github.com/thorchain/swap.thorchain'
const TCSWAP_REPO = 'https://github.com/thorchain/TCSwap'

// Official client libraries, one per language ecosystem. `status` states plainly
// where each one stands so the page never implies a registry release that has
// not happened. The TypeScript entry is the published @tcswap/sdk — the SDK this
// interface is itself built on — not a second client wrapping the same APIs.
export const SDK_PACKAGES = [
  {
    language: 'TypeScript / JavaScript',
    ecosystem: 'npm',
    name: '@tcswap/sdk',
    registryUrl: 'https://www.npmjs.com/package/@tcswap/sdk',
    source: `${TCSWAP_REPO}/tree/main/packages/sdk`,
    homepage: AppConfig.baseUrl,
    install: 'npm install @tcswap/sdk',
    status:
      'Published on npm. The full swap SDK — quotes and routing across THORChain and Maya, wallet connection, and transaction building — and the SDK this interface is itself built on.',
    exampleLanguage: 'ts',
    example: `import { USwapApi, createUSwap } from '@tcswap/sdk'

// Quotes and routes across every supported provider.
// Amounts here are decimal strings, not 1e8 base units.
const { routes } = await USwapApi.getSwapQuote({
  sellAsset: 'BTC.BTC',
  buyAsset: 'ETH.ETH',
  sellAmount: '0.1',
  destinationAddress: '0x...'
})

// Connect a wallet and sign locally; the SDK never holds keys for you.
const uswap = createUSwap()`
  },
  {
    language: 'Python',
    ecosystem: 'PyPI',
    name: 'thorchain-swap',
    source: `${REPO}/tree/main/sdk/python`,
    homepage: AppConfig.baseUrl,
    install: `pip install "git+${REPO}#subdirectory=sdk/python"`,
    status: `Source published in this repository, covering the keyless public surfaces of this site — no API key, token, or sign-in. Install directly from git — \`pip install "git+${REPO}#subdirectory=sdk/python"\` — until the PyPI release is cut.`,
    exampleLanguage: 'python',
    example: `from thorchain_swap import ThorchainSwapClient

client = ThorchainSwapClient()

quote = client.get_swap_quote(
    from_asset="BTC.BTC",
    to_asset="ETH.ETH",
    amount="100000000",  # 1 BTC, in 1e8 base units
)

print(quote["expected_amount_out"])`
  },
  {
    language: 'Go',
    ecosystem: 'Go modules',
    name: 'github.com/thorchain/swap.thorchain/sdk/go',
    source: `${REPO}/tree/main/sdk/go`,
    homepage: AppConfig.baseUrl,
    install: 'go get github.com/thorchain/swap.thorchain/sdk/go',
    status:
      'Source published in this repository, covering the keyless public surfaces of this site, and importable as a Go module directly from the repository path.',
    exampleLanguage: 'go',
    example: `package main

import (
	"context"
	"fmt"

	thorchainswap "github.com/thorchain/swap.thorchain/sdk/go"
)

func main() {
	client := thorchainswap.NewClient()

	quote, err := client.GetSwapQuote(context.Background(), thorchainswap.SwapQuoteRequest{
		FromAsset: "BTC.BTC",
		ToAsset:   "ETH.ETH",
		Amount:    "100000000",
	})
	if err != nil {
		panic(err)
	}

	fmt.Println(quote["expected_amount_out"])
}`
  }
]
