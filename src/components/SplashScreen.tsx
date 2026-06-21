import { useEffect, useState } from "react";
import logo from "@/assets/logo-esencia.png";

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 1700);
    const t2 = setTimeout(() => onDone(), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[9999] grid place-items-center transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      style={{
        background:
          "radial-gradient(circle at 50% 45%, hsl(285 40% 8%) 0%, hsl(280 45% 4%) 55%, #000 100%)",
      }}
      aria-hidden
    >
      <div
        className="relative"
        style={{ animation: "splashFade 1.4s ease-out both" }}
      >
        {/* Soft neon glow halo */}
        <div
          className="absolute inset-0 -m-20 rounded-full blur-3xl opacity-80"
          style={{
            background:
              "radial-gradient(circle, hsl(325 95% 60% / 0.45) 0%, hsl(110 80% 55% / 0.18) 45%, transparent 72%)",
            animation: "splashPulse 2.4s ease-in-out infinite",
          }}
        />
        <img
          src={logo}
          alt="Esencia de Bienestar"
          className="relative w-72 h-72 sm:w-80 sm:h-80 object-contain drop-shadow-[0_0_40px_rgba(255,90,200,0.55)]"
          draggable={false}
        />
      </div>

      <style>{`
        @keyframes splashFade {
          0% { opacity: 0; transform: scale(0.92); filter: blur(8px); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes splashPulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
}
