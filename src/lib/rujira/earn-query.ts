export const EARN_ASSET_FRAGMENT = `
  fragment EarnAsset on Asset {
    asset type chain
    metadata { symbol decimals name pngUrl }
    price { current }
  }
`

export const EARN_TRADE_QUERY = `
  query EarnTradeMarkets($after: String) {
    finV3 {
      pairs(first: 20, after: $after, sortBy: NAME, sortDir: ASC) {
        pageInfo { hasNextPage endCursor }
        edges { node {
          id address
          assetBase { ...EarnAsset }
          assetQuote { ...EarnAsset }
        } }
      }
    }
  }
  ${EARN_ASSET_FRAGMENT}
`

export const EARN_LENDING_QUERY = `
  query EarnLendingMarkets($after: String) {
    strategies(first: 50, after: $after, typenames: ["GhostVault"]) {
      pageInfo { hasNextPage endCursor }
      edges { node { ... on GhostVault {
        id address asset { ...EarnAsset }
        status { lendRate apr { value status } }
      } } }
    }
  }
  ${EARN_ASSET_FRAGMENT}
`

export const EARN_STAKING_QUERY = `
  query EarnStakingMarkets {
    staking { pools {
      id address bondAsset { ...EarnAsset }
    } }
  }
  ${EARN_ASSET_FRAGMENT}
`

// Analytics DecimalValue scalars are already decimal ratios, unlike Main API Bigint scalars.
export const EARN_CCL_METRICS_QUERY = `
  query EarnCclMetrics($after: String) {
    analytics { products { amm {
      strategies(first: 50, after: $after, filter: { typeIds: ["CCL"] },
        orderBy: { field: APR, direction: DESC, range: { trailing: { value: 30, unit: DAY } } }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          strategy { pair { contractAddress } }
          apr(range: { trailing: { value: 30, unit: DAY } })
        }
      }
    } } }
  }
`

export const EARN_STAKING_METRICS_QUERY = `
  query EarnStakingMetrics {
    analytics {
      ruji: staking(token: RUJI) { ...EarnStakingApr }
      brune: staking(token: BRUNE) { ...EarnStakingApr }
      tcy: staking(token: TCY) { ...EarnStakingApr }
    }
  }
  fragment EarnStakingApr on StakingAnalytics {
    history(range: { trailing: { value: 30, unit: DAY } }, resolution: DAY) {
      isComplete
      apr
    }
  }
`
