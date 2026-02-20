import type { ReactNode } from "react";

export const metadata = {
  title: "Build A Habit Tracker With Field",
  description: "Full-stack app generated from: "Build a habit tracker with fields: habitName, frequency (daily, weekly), streak (number), lastCompletedDate (date), active (boolean).""
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", margin: 0 }}>{children}</body>
    </html>
  );
}
