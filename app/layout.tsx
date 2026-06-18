import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "オーナーポータル",
  description: "賃貸収支透明化アプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
