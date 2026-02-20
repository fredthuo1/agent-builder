import type { ReactNode } from "react";

export const metadata = {
  title: "Build A Mini Crm For Contacts Wi",
  description: "Full-stack app generated from: "Build a mini CRM for contacts with fields: name, email, phone, company, stage (lead, qualified, customer), notes.""
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", margin: 0 }}>{children}</body>
    </html>
  );
}
