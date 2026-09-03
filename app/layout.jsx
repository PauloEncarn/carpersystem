import { ChunkReloadGuard } from "@/components/ChunkReloadGuard";
import "./globals.css";

export const metadata = {
  title: "Carper System RG",
  description: "Sistema de qualidade e rastreabilidade Cicopal",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="modern-ui">
        <ChunkReloadGuard />
        {children}
      </body>
    </html>
  );
}
