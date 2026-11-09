const ANALYTICS_TOKEN_FRAGMENT = `
  fragment AnalyticsTokenFields on Token {
    id symbol decimals name iconUrl chain { id }
  }
`

export const EARN_TRADE_QUERY = `
  query EarnTradeMarkets($after: String) {
    analytics { products { trade {
      pairs(first: 50, after: $after, orderBy: { field: PAIR, direction: ASC }) {
        pageInfo { hasNextPage endCursor }
        nodes { pair {
          id
          baseToken { ...AnalyticsTokenFields }
          quoteToken { ...AnalyticsTokenFields }
        } }
      }
    } } }
  }
  ${ANALYTICS_TOKEN_FRAGMENT}
`

export const EARN_LENDING_QUERY = `
  query EarnLendingMarkets($after: String) {
    analytics { products { moneyMarket {
      markets(first: 50, after: $after, orderBy: { field: LENDING_APR, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes { id token { ...AnalyticsTokenFields } apr(side: LENDING) }
      }
    } } }
  }
  ${ANALYTICS_TOKEN_FRAGMENT}
`

export const EARN_AUTOMATED_METRICS_QUERY = `
  query EarnAutomatedMetrics($after: String) {
    analytics { products { amm {
      strategies(first: 50, after: $after, onePerPair: true, filter: { typeIds: ["CCL", "DCL"] },
        orderBy: { field: APR, direction: DESC, range: { trailing: { value: 30, unit: DAY } } }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          strategy { pair { id } }
          apr(range: { trailing: { value: 30, unit: DAY } })
        }
      }
    } } }
  }
`

export const EARN_STAKING_QUERY = `
  query EarnStakingMarkets {
    analytics {
      ruji: staking(token: RUJI) { ...EarnStakingPool }
      brune: staking(token: BRUNE) { ...EarnStakingPool }
      tcy: staking(token: TCY) { ...EarnStakingPool }
    }
  }
  fragment EarnStakingPool on StakingAnalytics {
    pool { id stakedToken { ...AnalyticsTokenFields } }
    current { apr(averageOver: { trailing: { value: 30, unit: DAY } }) }
  }
  ${ANALYTICS_TOKEN_FRAGMENT}
`
