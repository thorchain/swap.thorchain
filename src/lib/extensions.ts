import { BigIntArithmetics } from '@swapkit/helpers'

BigIntArithmetics.prototype.toSignificant = function (significantDigits: number | undefined = 6): string {
  const valueStr = this.getValue('string')
  const [int = '', dec = ''] = valueStr.split('.')
  const hasInteger = Number.parseInt(int, 10) > 0
  const totalLength = hasInteger ? int.length + dec.length : dec.length

  if (totalLength <= significantDigits) return valueStr
  if (int.length >= significantDigits) return int.slice(0, significantDigits).padEnd(int.length, '0')
  if (hasInteger) return `${int}.${dec.slice(0, significantDigits - int.length)}`

  const trimmed = BigInt(dec).toString()
  const sliced = trimmed.slice(0, significantDigits)
  const leadingZeros = dec.length - trimmed.length

  return `0.${sliced.padStart(leadingZeros + sliced.length, '0')}`
}
