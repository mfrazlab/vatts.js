import React from 'react';
import {Metadata, router} from "vatts/react"
import './globals.css';
import {AnimatePresence, motion} from "framer-motion";
import 'prismjs/themes/prism-tomorrow.css'; // Tema escuro do Prism
interface LayoutProps {
    children: React.ReactNode;
}


export const metadata: Metadata = {
    title: "Vatts.js | The Fastest Framework for React",
    description: "The fastest and simplest web framework for React! Start building high-performance web applications today with Vatts.js.",
    favicon: '/vatts-icon.png'

};

export default function Layout({ children }: LayoutProps) {
    const variants = {
        hidden: { opacity: 0, y: 15 },
        enter: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -15 },
    };

    return (
        <AnimatePresence
            mode="wait"
            onExitComplete={() => window.scrollTo(0, 0)}
        >
            <motion.div
                key={router.pathname}
                variants={variants}
                initial="hidden"
                animate="enter"
                exit="exit"
                transition={{ type: 'tween', ease: 'easeInOut', duration: 0.4 }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
