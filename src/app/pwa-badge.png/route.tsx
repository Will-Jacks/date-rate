import { ImageResponse } from "next/og";

/** Ícone monocromático (Android usa na barra de status). */
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={72} height={72} viewBox="0 0 24 24">
          <path
            d="M12 21s-8-5-8-11.2C4 6.6 6.4 4.5 9 4.5c1.4 0 2.4.7 3 1.7.6-1 1.6-1.7 3-1.7 2.6 0 5 2.1 5 5.3C20 16 12 21 12 21z"
            fill="#ffffff"
          />
        </svg>
      </div>
    ),
    { width: 96, height: 96 },
  );
}
