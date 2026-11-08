import Decimal from 'decimal.js'
import type { BorrowAsset } from './borrow-markets'

const D = Decimal.clone({ precision: 40 })
const positive = (value?: string | null) => !!value && value !== '.' && new D(value).isFinite() && new D(value).gt(0)

// Both inputs are token-unit amounts. The protocol applies the collateral risk ratio
// before calculating LTV; this matches Rujira's single-collateral Credit Account preview.
export const borrowAmountForLtv = (
  deposit: BorrowAsset | undefined,
  borrow: BorrowAsset | undefined,
  depositAmount: string,
  ltvPercent: number
): string | null => {
  if (
    !deposit ||
    !borrow ||
    !positive(deposit.usdPrice) ||
    !positive(borrow.usdPrice) ||
    !positive(deposit.collateralRatio) ||
    !positive(depositAmount)
  )
    return null
  return new D(depositAmount)
    .mul(deposit.usdPrice!)
    .mul(deposit.collateralRatio!)
    .mul(D.max(0, D.min(100, ltvPercent)))
    .div(100)
    .div(borrow.usdPrice!)
    .toDecimalPlaces(borrow.decimals, Decimal.ROUND_DOWN)
    .toFixed()
}

const projectedInterestRate = (borrow: BorrowAsset | undefined, amount: string): string | null => {
  if (!borrow) return null
  const curve = borrow.interest
  if (!curve || !positive(amount)) return borrow.borrowRate ?? null
  const deposits = new D(curve.totalDeposits)
  if (deposits.lte(0)) return curve.baseRate
  const utilization = D.max(0, D.min(1, new D(curve.totalDebt).add(amount).div(deposits)))
  const target = new D(curve.targetUtilization)
  if (utilization.lte(target)) {
    return new D(curve.baseRate).add(target.gt(0) ? utilization.mul(curve.step1).div(target) : 0).toFixed()
  }
  return new D(curve.baseRate)
    .add(curve.step1)
    .add(utilization.sub(target).mul(new D(curve.step2).sub(curve.step1)).div(new D(1).sub(target)))
    .toFixed()
}

export const calculateBorrowPreview = (
  deposit: BorrowAsset | undefined,
  borrow: BorrowAsset | undefined,
  depositAmount: string,
  borrowAmount: string,
  liquidationThreshold?: string
) => {
  const interestRate = projectedInterestRate(borrow, borrowAmount)
  if (
    !deposit ||
    !borrow ||
    !positive(deposit.usdPrice) ||
    !positive(borrow.usdPrice) ||
    !positive(deposit.collateralRatio) ||
    !positive(depositAmount)
  ) {
    return { ltvPercent: null, liquidationPrice: null, liquidationRatio: null, interestRate }
  }
  const debtValue = new D(borrowAmount && borrowAmount !== '.' ? borrowAmount : 0).mul(borrow.usdPrice!)
  const adjustedCollateral = new D(depositAmount).mul(deposit.usdPrice!).mul(deposit.collateralRatio!)
  const ltvPercent = debtValue.div(adjustedCollateral).mul(100).toNumber()
  // A collateral liquidation-price estimate holds the debt price unchanged.
  // When both sides are the same asset, their prices move together instead.
  const liquidationPrice =
    debtValue.gt(0) && positive(liquidationThreshold) && deposit.marketId !== borrow.marketId
      ? debtValue.div(new D(depositAmount).mul(deposit.collateralRatio!).mul(liquidationThreshold!)).toFixed()
      : null
  // Quote the collateral's liquidation price in units of the borrowed asset.
  const liquidationRatio = liquidationPrice === null ? null : new D(liquidationPrice).div(borrow.usdPrice!).toFixed()
  return { ltvPercent, liquidationPrice, liquidationRatio, interestRate }
}
