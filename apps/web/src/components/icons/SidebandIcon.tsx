import React from 'react';

export interface SidebandIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  signalColor?: string;
}

/**
 * SIDEBAND custom geometric glyph:
 * Two parallel horizontal open channels intersecting a central slim vertical signal bar.
 */
export const SidebandIcon: React.FC<SidebandIconProps> = ({
  size = 24,
  signalColor = 'var(--signal, #A0BF9F)',
  className,
  style,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...props}
    >
      {/* Top horizontal open channel (flanged endpoints) */}
      <path
        d="M 3 6 V 9 H 21 V 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bottom horizontal open channel (flanged endpoints) */}
      <path
        d="M 3 18 V 15 H 21 V 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Central slim vertical signal bar intersecting both channels */}
      <line
        x1="12"
        y1="2.5"
        x2="12"
        y2="21.5"
        stroke={signalColor}
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      {/* Signal contact nodes on intersection */}
      <rect
        x="10.5"
        y="7.75"
        width="3"
        height="2.5"
        rx="0.5"
        fill={signalColor}
      />
      <rect
        x="10.5"
        y="13.75"
        width="3"
        height="2.5"
        rx="0.5"
        fill={signalColor}
      />
    </svg>
  );
};

export default SidebandIcon;
