import { useEffect, useRef, useState } from 'react';

export type RevealOptions = {
    /** IntersectionObserver threshold. */
    threshold?: number;
    /** Root margin (e.g. '0px 0px -10% 0px'). */
    rootMargin?: string;
    /** If true, reveal only once and keep visible after leaving viewport. */
    once?: boolean;
};

/**
 * Scroll-reveal via IntersectionObserver.
 *
 * Usage:
 *   const { ref, isVisible, props } = useScrollReveal({ once: true });
 *   <div ref={ref} {...props}>...</div>
 */
export function useScrollReveal(options: RevealOptions = {}) {
    const { threshold = 0.15, rootMargin = '0px 0px -10% 0px', once = true } = options;

    const ref = useRef<HTMLElement | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;
        if (typeof window === 'undefined') return;

        if (!('IntersectionObserver' in window)) {
            setIsVisible(true);
            return;
        }

        const io = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry) return;

                if (entry.isIntersecting) {
                    setIsVisible(true);
                    if (once) io.disconnect();
                } else if (!once) {
                    setIsVisible(false);
                }
            },
            { threshold, rootMargin }
        );

        io.observe(node);
        return () => io.disconnect();
    }, [once, rootMargin, threshold]);

    return {
        ref,
        isVisible,
        props: {
            'data-reveal-visible': isVisible ? 'true' : 'false',
        } as const,
    };
}
