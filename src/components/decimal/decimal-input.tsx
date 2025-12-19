import { FC } from 'react'
import { NumericFormat, NumericFormatProps, OnValueChange } from 'react-number-format'

const separators = () => {
  const formatter = new Intl.NumberFormat()
  const parts = formatter.formatToParts(12345.6)
  const group = parts.find(p => p.type === 'group')?.value || ','
  const decimal = parts.find(p => p.type === 'decimal')?.value || '.'
  return { group, decimal }
}
const { decimal, group } = separators()

export const DecimalInput: FC<
  NumericFormatProps & {
    amount: string
    onAmountChange: (v: string) => void
  }
> = ({ amount, onAmountChange, disabled, ...rest }) => {
  const onValueChange: OnValueChange = values => {
    onAmountChange(values.value)
  }

  return (
    <NumericFormat
      allowNegative={false}
      decimalSeparator={decimal}
      thousandSeparator={group}
      disabled={disabled}
      placeholder="0"
      value={amount}
      onValueChange={onValueChange}
      inputMode="decimal"
      {...rest}
    />
  )
}
