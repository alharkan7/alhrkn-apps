import { motion } from 'framer-motion';

export function TypingIndicator() {
    const dots = [0, 1, 2];
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
        >
            <div className="px-1 py-3 text-black/38 dark:text-white/38">
                <div className="flex items-center gap-1">
                    {dots.map((dot) => (
                        <motion.div
                            key={dot}
                            className="size-1.5 rounded-full bg-current"
                            animate={{
                                y: ["0%", "-50%", "0%"]
                            }}
                            transition={{
                                duration: 0.8,
                                repeat: Infinity,
                                repeatType: "reverse",
                                delay: dot * 0.15,
                                ease: "easeInOut"
                            }}
                        />
                    ))}
                </div>
            </div>
        </motion.div>
    );
}
