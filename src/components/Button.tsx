import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  icon?: ReactNode;
}

/** Mirrors the Figma "Button" component (Variant × Size × State). */
export function Button({ variant = 'primary', size = 'sm', icon, children, className = '', ...rest }: Props) {
  return (
    <button className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}
