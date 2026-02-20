import type { ReactNode } from "react";

export const metadata = {
  title: "Build An Ecommerce App",
  description: "Full-stack app generated from: "Build an eCommerce app""
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", margin: 0 }}>{children}</body>
    </html>
  );
}
