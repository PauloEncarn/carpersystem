import { ChunkReloadGuard } from "@/components/ChunkReloadGuard";
import "./globals.css";

export const metadata = {
  title: "Carper System RG",
  description: "Sistema de qualidade e rastreabilidade Cicopal"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <ChunkReloadGuard />
        {children}
      </body>
    </html>
  );
}
