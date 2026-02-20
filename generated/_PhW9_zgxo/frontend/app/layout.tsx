
export default function RootLayout({ children }) {
  return (
    <html>
      <body style={{ fontFamily: "system-ui", margin: 0 }}>{children}</body>
    </html>
  );
}
