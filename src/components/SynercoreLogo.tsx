// src/components/SynercoreLogo.tsx
import React, { CSSProperties } from 'react';
import fullLogo from '../assets/synercore-logo.png'; // ← put your PNG here

interface SynercoreLogoProps {
  size?: 'small' | 'medium' | 'large' | number;
  className?: string;
  style?: CSSProperties;
}

/**
 * SynercoreLogo
 * Props:
 *  - size: 'small' | 'medium' | 'large' | number (px height)  (default 'large')
 *  - className, style: pass-through
 */
const SynercoreLogo: React.FC<SynercoreLogoProps> = ({
  size = 'large',
  className = '',
  style = {},
}) => {
  const heightMap = { small: 24, medium: 80, large: 48 }; // tweak as you like
  const logoHeight = typeof size === 'number' ? size : (heightMap[size as keyof typeof heightMap] ?? 48);

  return (
    <img
      src={fullLogo}
      alt="Synercore — Leaders in Food Innovation"
      className={className}
      style={{ height: logoHeight, width: 'auto', display: 'inline-block', ...style }}
      draggable={false}
    />
  );
};

export default SynercoreLogo;
