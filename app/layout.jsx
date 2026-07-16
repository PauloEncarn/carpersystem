import { Montserrat } from "next/font/google";
import { ChunkReloadGuard } from "@/components/ChunkReloadGuard";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap"
});

export const metadata = {
  title: "Carper System RG",
  description: "Sistema de qualidade e rastreabilidade Cicopal"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={montserrat.variable}>
        <ChunkReloadGuard />
        {children}
      </body>
    </html>
  );
}
