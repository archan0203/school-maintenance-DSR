import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "ระบบแจ้งซ่อมโรงเรียน", description: "ระบบบริหารจัดการงานซ่อมแซมอาคารสถานที่" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
