import type { Metadata } from 'next';
import './globals.css';
import './readability.css';

export const metadata: Metadata = {
  title: 'Campo Lindo Transaccional',
  description: 'Mercado transaccional de frutas y hortalizas con compra inmediata, subastas y órdenes de compra.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
