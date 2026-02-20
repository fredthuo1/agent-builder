import type { ReactNode } from "react";

export const metadata = {
  title: "Build A Habit Tracker For Daily",
  description: "Full-stack app generated from: "Build a habit tracker for daily workouts""
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", margin: 0 }}>{children}</body>
    </html>
  );
}
