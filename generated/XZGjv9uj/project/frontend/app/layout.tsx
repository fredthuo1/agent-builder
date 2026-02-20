import "./globals.css";

export const metadata = {
  title: "DogMarket",
  description: "Generated app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
