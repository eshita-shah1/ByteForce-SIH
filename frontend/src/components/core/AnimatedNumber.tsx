import React, { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';

export interface AnimatedNumberProps {
  value: number;
  className?: string;
  springOptions?: {
    bounce?: number;
    duration?: number;
    stiffness?: number;
    damping?: number;
    mass?: number;
  };
  duration?: number;
  decimals?: number;
  format?: (value: number) => string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  className = '',
  springOptions,
  duration,
  decimals = 0,
  format,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Animation duration in seconds (defaults to 1.8s for satisfying easing)
    const animDuration = duration 
      ? duration 
      : springOptions?.duration 
      ? springOptions.duration / 1000 
      : 1.8;

    const start = prevValue.current;
    prevValue.current = value;

    const controls = animate(start, value, {
      duration: animDuration,
      ease: [0.16, 1, 0.3, 1], // Smooth exponential ease-out
      onUpdate: (latest) => {
        if (format) {
          node.textContent = format(latest);
        } else if (decimals > 0) {
          node.textContent = latest.toFixed(decimals);
        } else {
          node.textContent = Math.round(latest).toLocaleString();
        }
      },
    });

    return () => controls.stop();
  }, [value, duration, springOptions, decimals, format]);

  return (
    <span ref={ref} className={className}>
      {format 
        ? format(value) 
        : decimals > 0 
        ? value.toFixed(decimals) 
        : Math.round(value).toLocaleString()
      }
    </span>
  );
};
