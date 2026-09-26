import './globals.css';

export const metadata = {
  title: 'Skyline Beauty Parlour — Accounting & Checkout System',
  description: 'Front desk billing, dynamic UPI QR payments, and owner analytics dashboard for Skyline Beauty Parlour',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased text-[#2E1620] bg-[#FAF4F0]">
        {children}
      </body>
    </html>
  );
}
