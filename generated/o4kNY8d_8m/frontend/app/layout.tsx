
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body style={{ fontFamily: "system-ui" }}>{children}</body>
    </html>
  );
}
