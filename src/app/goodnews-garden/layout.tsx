
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './visualizer.css';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-primary',
    display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    variable: '--font-mono',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Good News Garden',
    description: 'Watch positive news bloom in an interactive garden of stories',
};

export default function Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div
            className={`${inter.variable} ${jetbrainsMono.variable} font-sans light`}
            data-theme="light"
            style={{ colorScheme: 'light' }}
        >
            {children}
        </div>
    );
}

