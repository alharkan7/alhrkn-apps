'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const MESSAGES = [
  "Analyzing your input...",
  "Structuring the layout...",
  "Routing connectors neatly...",
  "Applying soft pastel styles...",
  "Adding the finishing touches...",
];

export function PlayfulLoader() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, MESSAGES.length - 1));
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] bg-background/50 backdrop-blur-sm rounded-xl">
      <div className="relative w-24 h-24 mb-10">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 180, 270, 360],
            borderRadius: ["20%", "50%", "20%"]
          }}
          transition={{
            duration: 2,
            ease: "easeInOut",
            times: [0, 0.5, 1],
            repeat: Infinity,
          }}
          className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-cyan-400 opacity-80"
        />
        <motion.div
          animate={{
            scale: [1, 1.5, 1],
            rotate: [360, 270, 180, 90, 0],
            borderRadius: ["50%", "20%", "50%"]
          }}
          transition={{
            duration: 3,
            ease: "easeInOut",
            times: [0, 0.5, 1],
            repeat: Infinity,
          }}
          className="absolute inset-2 bg-gradient-to-tr from-emerald-400 to-cyan-500 opacity-60 mix-blend-multiply"
        />
        <motion.div
          animate={{
            scale: [0.8, 1.1, 0.8],
            rotate: [0, -180, -360],
            borderRadius: ["30%", "40%", "30%"]
          }}
          transition={{
            duration: 2.5,
            ease: "easeInOut",
            times: [0, 0.5, 1],
            repeat: Infinity,
          }}
          className="absolute inset-4 bg-gradient-to-bl from-pink-400 to-indigo-500 opacity-50 mix-blend-overlay"
        />
      </div>
      <div className="h-8 flex items-center justify-center">
        <motion.p
          key={messageIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          className="text-lg font-medium text-foreground tracking-tight"
        >
          {MESSAGES[messageIndex]}
        </motion.p>
      </div>
      {/* <p className="text-sm text-muted-foreground mt-2 animate-pulse">
        Crafting a beautiful freeform diagram...
      </p> */}
    </div>
  );
}
