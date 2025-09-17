import { memo, SVGProps } from 'react'

type Props = {
  children?: React.ReactNode
} & SVGProps<SVGSVGElement>

const SVG = ({ children, ...rest }: Props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...rest}>
    {children}
  </svg>
)

const PlusSvg = (props: SVGProps<SVGSVGElement>) => (
  <SVG {...props}>
    <path d="M13 11H20V13H13V20H11V13H4V11H11V4H13V11Z" fill="currentColor" />
  </SVG>
)

const PencilSvg = (props: SVGProps<SVGSVGElement>) => {
  return (
    <SVG {...props}>
      <path
        d="M22 8.41406L9.41211 21.0029L3 20.9639V14.5859L15.5859 2L22 8.41406ZM5 15.4141V18.9756L8.58789 18.9971L15.002 12.583L11.4512 8.96191L5 15.4141ZM12.8652 7.54785L16.416 11.1689L19.1719 8.41406L15.5859 4.82812L12.8652 7.54785Z"
        fill="currentColor"
      />
    </SVG>
  )
}

export const Plus = memo(PlusSvg)
export const Pencil = memo(PencilSvg)
