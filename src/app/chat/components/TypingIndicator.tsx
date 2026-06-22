import { motion } from 'framer-motion';

export function TypingIndicator() {
    const dots = [0, 1, 2];
    
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
        >
            <div className="rounded-[2rem] px-5 py-3 bg-background/80 backdrop-blur-2xl border border-border/50 text-foreground rounded-bl-sm shadow-sm">
                <div className="flex items-center gap-1">
                    {dots.map((dot) => (
                        <motion.div
                            key={dot}
                            className="w-1.5 h-1.5 bg-current rounded-full"
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
