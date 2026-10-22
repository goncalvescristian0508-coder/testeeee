import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Life OS",
    short_name: "Life OS",
    description: "Sistema pessoal de rotina, hábitos, sono e foco.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#121212",
    theme_color: "#121212",
    lang: "pt-BR",
    categories: ["productivity", "lifestyle", "health"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Foco", url: "/foco", description: "Iniciar uma sessão de foco" },
      { name: "Hábitos", url: "/habitos", description: "Marcar hábitos de hoje" },
      { name: "Agenda", url: "/agenda", description: "Ver compromissos" },
    ],
  };
}
