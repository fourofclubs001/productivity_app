import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant =
  | 'primary'
  | 'outlined'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'neutral'
  | 'icon'

export type ButtonSize = 'md' | 'sm'

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-sm text-ui font-medium ' +
  'select-none transition-colors disabled:opacity-50 disabled:pointer-events-none ' +
  'focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  // Google's secondary action: blue text in a gray outline, not gray text
  outlined: 'border border-border text-accent hover:bg-accent-soft',
  ghost: 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
  danger: 'bg-danger text-white hover:bg-danger-hover',
  success: 'bg-success text-white hover:bg-success-hover',
  neutral: 'bg-surface-alt text-text-primary hover:bg-surface-hover',
  icon: 'rounded-full text-text-secondary hover:bg-surface-hover hover:text-text-primary',
}

const TEXT_SIZES: Record<ButtonSize, string> = {
  md: 'h-8 px-3',
  sm: 'h-7 px-2',
}

const ICON_SIZES: Record<ButtonSize, string> = {
  md: 'h-8 w-8',
  sm: 'h-7 w-7',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children?: ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const sizing = variant === 'icon' ? ICON_SIZES[size] : TEXT_SIZES[size]
  return (
    <button type={type} className={`${BASE} ${VARIANTS[variant]} ${sizing} ${className}`.trim()} {...rest}>
      {children}
    </button>
  )
}
