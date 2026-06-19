import { KnownIconType } from '@charcoal-ui/icons'
import { ButtonHTMLAttributes } from 'react'
import Image from 'next/image'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  iconName: keyof KnownIconType | 'screen-share' | 'stop' | 'game-controller'
  isProcessing: boolean
  isProcessingIcon?: keyof KnownIconType
  label?: string
  labelClassName?: string
  iconColor?: string
  backgroundColor?: string
}

export const IconButton = ({
  iconName,
  isProcessing,
  isProcessingIcon,
  label,
  labelClassName = '',
  iconColor,
  backgroundColor = 'bg-primary hover:bg-primary-hover active:bg-primary-press disabled:bg-primary-disabled',
  ...rest
}: Props) => {
  const customIconClassName =
    iconColor === 'text-text1' ? 'brightness-0 opacity-80' : ''

  const iconElement = isProcessing ? (
    <pixiv-icon name={(isProcessingIcon || '24/Dot') as any} scale="1" />
  ) : iconName === 'screen-share' ? (
    <Image
      src="/images/icons/screen-share.svg"
      alt="screen share"
      width={24}
      height={24}
      className={`block ${customIconClassName}`}
    />
  ) : iconName === 'game-controller' ? (
    <Image
      src="/images/icons/game-controller.svg"
      alt="game controller"
      width={24}
      height={24}
      className={`block ${customIconClassName}`}
    />
  ) : iconName === 'stop' ? (
    <Image
      src="/images/icons/stop.svg"
      alt="stop"
      width={24}
      height={24}
      className="block"
    />
  ) : (
    <pixiv-icon name={iconName as any} scale="1" />
  )

  return (
    <button
      {...rest}
      className={`${backgroundColor} rounded-2xl text-sm p-2 min-w-[44px] min-h-[44px] justify-center text-center inline-flex items-center
        ${iconColor || 'text-theme'}
        ${rest.className}
      `}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center">
        {iconElement}
      </span>
      {label && (
        <div className={`mx-2 font-bold ${labelClassName}`}>{label}</div>
      )}
    </button>
  )
}
