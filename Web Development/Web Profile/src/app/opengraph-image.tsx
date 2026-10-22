import { ImageResponse } from "next/og";
import { profile } from "@/data/profile";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "#0a0a0a",
          color: "#ededed",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#a3a3a3",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {profile.person.title}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 600, lineHeight: 1.15 }}>
            {profile.person.headline.en}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#a3a3a3" }}>
            {profile.person.name}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
