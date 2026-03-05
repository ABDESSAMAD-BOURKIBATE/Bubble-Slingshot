/**
 * Swipe and Drag Navigation Hook
 * Enables navigation through swipe gestures (touch) and mouse drag
 */

import { useEffect, useRef } from 'react';

interface SwipeConfig {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    threshold?: number; // Minimum distance for swipe (default: 50px)
}

export const useSwipeNavigation = (config: SwipeConfig) => {
    const {
        onSwipeLeft,
        onSwipeRight,
        onSwipeUp,
        onSwipeDown,
        threshold = 50
    } = config;

    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const mouseStartRef = useRef<{ x: number; y: number } | null>(null);
    const isDraggingRef = useRef(false);

    useEffect(() => {
        // Touch Events
        const handleTouchStart = (e: TouchEvent) => {
            const touch = e.touches[0];
            touchStartRef.current = {
                x: touch.clientX,
                y: touch.clientY
            };
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (!touchStartRef.current) return;

            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - touchStartRef.current.x;
            const deltaY = touch.clientY - touchStartRef.current.y;

            const absDeltaX = Math.abs(deltaX);
            const absDeltaY = Math.abs(deltaY);

            // Determine swipe direction
            if (absDeltaX > threshold || absDeltaY > threshold) {
                if (absDeltaX > absDeltaY) {
                    // Horizontal swipe
                    if (deltaX > 0 && onSwipeRight) {
                        onSwipeRight();
                    } else if (deltaX < 0 && onSwipeLeft) {
                        onSwipeLeft();
                    }
                } else {
                    // Vertical swipe
                    if (deltaY > 0 && onSwipeDown) {
                        onSwipeDown();
                    } else if (deltaY < 0 && onSwipeUp) {
                        onSwipeUp();
                    }
                }
            }

            touchStartRef.current = null;
        };

        // Mouse Events
        const handleMouseDown = (e: MouseEvent) => {
            // Only left click
            if (e.button !== 0) return;

            mouseStartRef.current = {
                x: e.clientX,
                y: e.clientY
            };
            isDraggingRef.current = true;
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (!mouseStartRef.current || !isDraggingRef.current) return;

            const deltaX = e.clientX - mouseStartRef.current.x;
            const deltaY = e.clientY - mouseStartRef.current.y;

            const absDeltaX = Math.abs(deltaX);
            const absDeltaY = Math.abs(deltaY);

            // Determine drag direction
            if (absDeltaX > threshold || absDeltaY > threshold) {
                if (absDeltaX > absDeltaY) {
                    // Horizontal drag
                    if (deltaX > 0 && onSwipeRight) {
                        onSwipeRight();
                    } else if (deltaX < 0 && onSwipeLeft) {
                        onSwipeLeft();
                    }
                } else {
                    // Vertical drag
                    if (deltaY > 0 && onSwipeDown) {
                        onSwipeDown();
                    } else if (deltaY < 0 && onSwipeUp) {
                        onSwipeUp();
                    }
                }
            }

            mouseStartRef.current = null;
            isDraggingRef.current = false;
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            // Optional: Add visual feedback during drag
            e.preventDefault();
        };

        // Add event listeners
        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mousemove', handleMouseMove);

        // Cleanup
        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchend', handleTouchEnd);
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mousemove', handleMouseMove);
        };
    }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);
};

// Visual Swipe Indicator Component
export const SwipeIndicator: React.FC<{ direction: 'left' | 'right' | 'up' | 'down' }> = ({ direction }) => {
    const arrows = {
        left: '←',
        right: '→',
        up: '↑',
        down: '↓'
    };

    return (
        <div className= "fixed bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 text-white text-sm font-medium animate-bounce z-50" >
        <span className="mr-2" > { arrows[direction]} </span>
      Swipe to navigate
        </div>
  );
};
