'use strict';

import React from 'react';
import styles from './GlowButton.module.css';

interface GlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'outline';
}

export const GlowButton: React.FC<GlowButtonProps> = ({
  children,
  variant = 'primary',
  className = '',
  ...props
}) => {
  const variantClass = styles[variant] || styles.primary;
  
  return (
    <button
      className={`${styles.glowBtn} ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
