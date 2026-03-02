import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Open Health Data Hub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const datasets = [
  { name: "Medicaid", color: "#EA580C" },
  { name: "Medicare", color: "#10B981" },
  { name: "BRFSS", color: "#0EA5E9" },
  { name: "NHANES", color: "#8B5CF6" },
];

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#0A0A0A",
          padding: "60px 80px",
        }}
      >
        {/* Database icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 72,
            height: 72,
            borderRadius: 16,
            backgroundColor: "rgba(234, 88, 12, 0.15)",
            marginBottom: 32,
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#EA580C"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5V19A9 3 0 0 0 21 19V5" />
            <path d="M3 12A9 3 0 0 0 21 12" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#FFFFFF",
            lineHeight: 1.1,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          Open Health Data Hub
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            color: "#9CA3AF",
            textAlign: "center",
            marginBottom: 40,
            maxWidth: 700,
          }}
        >
          Explore 240M+ rows of public health data with AI
        </div>

        {/* Dataset pills */}
        <div
          style={{
            display: "flex",
            gap: 16,
          }}
        >
          {datasets.map((ds) => (
            <div
              key={ds.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: 9999,
                border: `1px solid ${ds.color}40`,
                backgroundColor: `${ds.color}15`,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: ds.color,
                }}
              />
              <span style={{ fontSize: 18, color: ds.color, fontWeight: 600 }}>
                {ds.name}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(to right, #EA580C, #10B981, #0EA5E9, #8B5CF6)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
