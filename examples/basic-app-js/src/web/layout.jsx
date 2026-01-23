import React from 'react';
import {Metadata, router} from "vatts/react"
import './globals.css';
import {AnimatePresence, motion} from "framer-motion";
import {SessionProvider} from "@vatts/auth/react";


export const metadata = {
    title: "Vatts JS | The Fast and Simple Web Framework for React",
    description: "The fastest and simplest web framework for React! Start building high-performance web applications today with Vatts JS.",
    keywords: ["Vatts JS", "web framework", "React", "JavaScript", "TypeScript", "web development", "fast", "simple", "SSR", "frontend"],
    author: "Vatts JS Team",
};

export default function Layout({ children }) {
    const variants = {
        hidden: { opacity: 0, y: 15 },
        enter: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -15 },
    };

    return (
        <SessionProvider>
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
        </SessionProvider>
    );
}
