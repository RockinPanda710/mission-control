import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./today.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export default function TodayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`sil-theme ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      {/* SVG gradient definition for icon strokes */}
      <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
        <defs>
          <linearGradient id="sil-icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
        </defs>
      </svg>

      <div className="sil-bg">{children}</div>
    </div>
  );
}
