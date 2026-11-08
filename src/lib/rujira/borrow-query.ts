// Validated against data/graphql/rujira-schema.graphql. Only read operations belong here.
export const BORROW_MARKETS_QUERY = `
  query BorrowMarkets {
    ghostCredit {
      adjustmentThreshold
      liquidationThreshold
      collaterals {
        ratio
        price { current }
        asset { ...BorrowMarketAsset variants { layer1 { ...BorrowMarketAsset } } }
      }
      vaults {
        price { current }
        borrower {
          available
          vault {
            interest { baseRate step1 step2 targetUtilization }
            status { debtRate depositPool { size } debtPool { size } }
          }
          asset { ...BorrowMarketAsset variants { layer1 { ...BorrowMarketAsset } } }
        }
      }
    }
  }
  fragment BorrowMarketAsset on Asset {
    asset
    type
    chain
    metadata { symbol decimals name pngUrl }
  }
`
