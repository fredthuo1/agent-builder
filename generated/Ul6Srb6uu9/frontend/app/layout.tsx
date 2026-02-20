import "./globals.css";

export const metadata = {
  title: "Build a habit tracker with fields habitName fr",
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
