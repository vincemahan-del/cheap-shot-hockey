import type { Category } from "@/lib/types";

type Props = {
  category: Category;
  color: string;
  accent?: string;
};

export function ProductIllustration({ category, color, accent = "#0b0f16" }: Props) {
  switch (category) {
    case "sticks":
      return <StickIllustration color={color} accent={accent} />;
    case "skates":
      return <SkateIllustration color={color} accent={accent} />;
    case "helmets":
      return <HelmetIllustration color={color} accent={accent} />;
    case "gloves":
      return <GloveIllustration color={color} accent={accent} />;
    case "pads":
      return <PadIllustration color={color} accent={accent} />;
    case "jerseys":
      return <JerseyIllustration color={color} accent={accent} />;
    case "pucks":
      return <PuckIllustration color={color} accent={accent} />;
    case "goalie-gear":
      return <GoalieGearIllustration color={color} accent={accent} />;
    case "accessories":
      return <AccessoryIllustration color={color} accent={accent} />;
  }
}

type IProps = { color: string; accent: string };

function StickIllustration({ color, accent }: IProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="stick-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.65" />
        </linearGradient>
      </defs>
      {/* Shaft */}
      <g transform="rotate(-22 200 200)">
        <rect x="60" y="180" width="280" height="24" rx="3" fill="url(#stick-grad)" />
        {/* Grip tape wrap at top of shaft */}
        <g>
          {Array.from({ length: 14 }).map((_, i) => (
            <line
              key={i}
              x1={62 + i * 5}
              y1="180"
              x2={66 + i * 5}
              y2="204"
              stroke={accent}
              strokeOpacity="0.45"
              strokeWidth="1.5"
            />
          ))}
        </g>
        {/* Blade */}
        <path
          d="M 340 180 Q 378 186 386 206 L 386 214 Q 378 220 358 218 L 340 204 Z"
          fill={color}
          opacity="0.95"
        />
        {/* Blade tape stripes */}
        <g>
          {Array.from({ length: 8 }).map((_, i) => (
            <line
              key={i}
              x1={344 + i * 5}
              y1="184"
              x2={348 + i * 5}
              y2="214"
              stroke="#f3f4f6"
              strokeOpacity="0.35"
              strokeWidth="1.2"
            />
          ))}
        </g>
        {/* Knob */}
        <rect x="52" y="174" width="10" height="36" rx="3" fill={accent} opacity="0.85" />
      </g>
    </svg>
  );
}

function SkateIllustration({ color, accent }: IProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="skate-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {/* Boot */}
      <path
        d="M 80 120 C 80 100, 110 94, 160 98 L 250 110 C 290 114, 320 134, 322 168 L 322 210 C 322 230, 308 244, 290 246 L 110 246 C 92 246, 78 232, 78 212 Z"
        fill="url(#skate-grad)"
      />
      {/* Tongue */}
      <path
        d="M 110 120 L 170 104 L 176 200 L 116 200 Z"
        fill={accent}
        opacity="0.9"
      />
      {/* Laces */}
      {Array.from({ length: 5 }).map((_, i) => (
        <line
          key={i}
          x1={120}
          y1={138 + i * 16}
          x2={170}
          y2={130 + i * 16}
          stroke="#f3f4f6"
          strokeWidth="2.5"
        />
      ))}
      {/* Eyelets */}
      {Array.from({ length: 5 }).map((_, i) => (
        <circle
          key={i}
          cx={120}
          cy={138 + i * 16}
          r={3}
          fill="#f3f4f6"
        />
      ))}
      {/* Tendon guard */}
      <path
        d="M 78 120 L 100 108 L 108 170 L 80 174 Z"
        fill={color}
        opacity="0.7"
      />
      {/* Holder (chassis) */}
      <rect x="96" y="246" width="214" height="14" rx="2" fill={accent} opacity="0.85" />
      {/* Blade */}
      <rect x="100" y="260" width="210" height="6" rx="3" fill="#d1d5db" />
      <rect x="100" y="264" width="210" height="2" fill="#9ca3af" />
    </svg>
  );
}

function HelmetIllustration({ color, accent }: IProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="helmet-grad" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.65" />
        </radialGradient>
      </defs>
      {/* Shell */}
      <path
        d="M 100 200 C 100 120, 160 80, 220 80 C 290 80, 330 130, 330 200 L 330 230 L 100 230 Z"
        fill="url(#helmet-grad)"
      />
      {/* Vents */}
      {Array.from({ length: 3 }).map((_, i) => (
        <rect
          key={i}
          x={180 + i * 22}
          y={110}
          width={8}
          height={20}
          rx={3}
          fill={accent}
          opacity="0.5"
        />
      ))}
      {/* Ear cup */}
      <ellipse cx="115" cy="210" rx="22" ry="26" fill={accent} opacity="0.85" />
      {/* Chin strap */}
      <path
        d="M 130 230 C 180 290, 260 290, 320 230"
        stroke={accent}
        strokeWidth="5"
        fill="none"
        opacity="0.8"
      />
      {/* Cage */}
      <g stroke="#d1d5db" strokeWidth="3" fill="none" opacity="0.9">
        <path d="M 130 230 Q 220 320 320 230" />
        <line x1="160" y1="244" x2="160" y2="298" />
        <line x1="200" y1="252" x2="200" y2="316" />
        <line x1="240" y1="252" x2="240" y2="316" />
        <line x1="280" y1="244" x2="280" y2="298" />
        <line x1="140" y1="260" x2="310" y2="260" />
        <line x1="146" y1="285" x2="304" y2="285" />
      </g>
    </svg>
  );
}

function GloveIllustration({ color, accent }: IProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="glove-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {/* Cuff */}
      <rect x="60" y="230" width="280" height="70" rx="10" fill={accent} opacity="0.9" />
      {/* Palm back */}
      <rect x="90" y="130" width="200" height="130" rx="20" fill="url(#glove-grad)" />
      {/* Fingers */}
      {Array.from({ length: 4 }).map((_, i) => (
        <rect
          key={i}
          x={95 + i * 48}
          y={60}
          width={42}
          height={90}
          rx={16}
          fill="url(#glove-grad)"
        />
      ))}
      {/* Thumb */}
      <path
        d="M 280 130 Q 340 120 350 170 L 340 220 Q 320 230 300 220 Z"
        fill="url(#glove-grad)"
      />
      {/* Roll seams on cuff */}
      <g stroke={accent} strokeWidth="1.5" opacity="0.5">
        <line x1="70" y1="250" x2="330" y2="250" />
        <line x1="70" y1="272" x2="330" y2="272" />
      </g>
      {/* Finger segments */}
      <g stroke={accent} strokeWidth="1" opacity="0.4">
        {Array.from({ length: 4 }).map((_, i) => (
          <g key={i}>
            <line x1={95 + i * 48} y1={100} x2={137 + i * 48} y2={100} />
            <line x1={95 + i * 48} y1={130} x2={137 + i * 48} y2={130} />
          </g>
        ))}
      </g>
    </svg>
  );
}

function PadIllustration({ color, accent }: IProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pad-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {/* Shin pad outer */}
      <path
        d="M 140 60 Q 170 52 230 52 Q 260 52 260 90 L 270 320 Q 272 350 240 354 L 160 354 Q 128 350 130 320 L 140 90 Z"
        fill="url(#pad-grad)"
      />
      {/* Knee cup */}
      <ellipse cx="200" cy="110" rx="58" ry="46" fill={color} opacity="0.9" />
      <ellipse cx="200" cy="110" rx="40" ry="30" fill={accent} opacity="0.5" />
      {/* Segments */}
      {[170, 210, 250, 290].map((y, i) => (
        <rect
          key={i}
          x={146}
          y={y}
          width={108}
          height={22}
          rx={4}
          fill={accent}
          opacity={0.22}
        />
      ))}
      {/* Straps */}
      <rect x="120" y="180" width="160" height="8" rx="3" fill={accent} opacity="0.7" />
      <rect x="120" y="260" width="160" height="8" rx="3" fill={accent} opacity="0.7" />
    </svg>
  );
}

function JerseyIllustration({ color, accent }: IProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="jersey-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.8" />
        </linearGradient>
      </defs>
      {/* Body */}
      <path
        d="M 110 110 L 150 70 L 170 70 Q 200 100 230 70 L 250 70 L 290 110 L 320 160 L 290 180 L 280 340 L 120 340 L 110 180 L 80 160 Z"
        fill="url(#jersey-grad)"
      />
      {/* Shoulder stripes */}
      <path
        d="M 95 130 L 170 130 L 170 150 L 100 150 Z"
        fill={accent}
        opacity="0.55"
      />
      <path
        d="M 230 130 L 305 130 L 300 150 L 230 150 Z"
        fill={accent}
        opacity="0.55"
      />
      {/* Number */}
      <text
        x="200"
        y="260"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, Arial Black, sans-serif"
        fontWeight="900"
        fontSize="110"
        fill="#f3f4f6"
        opacity="0.9"
      >
        99
      </text>
      {/* Collar */}
      <path
        d="M 170 70 Q 200 90 230 70 L 222 92 Q 200 104 178 92 Z"
        fill={accent}
        opacity="0.85"
      />
    </svg>
  );
}

function PuckIllustration({ color, accent }: IProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      role="img"
      aria-hidden="true"
    >
      {/* Stack of pucks */}
      {[
        { cx: 200, cy: 280, rx: 130, ry: 38, fill: "#111418" },
        { cx: 200, cy: 220, rx: 130, ry: 38, fill: "#1a1f26" },
        { cx: 200, cy: 160, rx: 130, ry: 38, fill: "#232831" },
      ].map((p, i) => (
        <g key={i}>
          <rect
            x={p.cx - p.rx}
            y={p.cy}
            width={p.rx * 2}
            height={38}
            fill={p.fill}
          />
          <ellipse cx={p.cx} cy={p.cy + 38} rx={p.rx} ry={p.ry / 2} fill="#0b0f16" />
          <ellipse cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry / 1.4} fill={p.fill} />
        </g>
      ))}
      {/* Top puck face with logo */}
      <ellipse cx="200" cy="160" rx="130" ry="28" fill="#2a2f38" />
      <circle cx="200" cy="160" r="40" fill="none" stroke={color} strokeWidth="3" opacity="0.9" />
      <text
        x="200"
        y="170"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, Arial Black, sans-serif"
        fontWeight="900"
        fontSize="28"
        fill={color}
      >
        CS
      </text>
      {/* Edge highlight */}
      <ellipse cx="200" cy="160" rx="130" ry="28" fill="none" stroke={accent} strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

function GoalieGearIllustration({ color, accent }: IProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mask-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {/* Mask shell */}
      <path
        d="M 110 140 C 120 90, 170 70, 200 70 C 230 70, 280 90, 290 140 L 300 260 C 300 290, 260 310, 200 310 C 140 310, 100 290, 100 260 Z"
        fill="url(#mask-grad)"
      />
      {/* Forehead band */}
      <path
        d="M 110 140 L 290 140 L 286 170 L 114 170 Z"
        fill={accent}
        opacity="0.6"
      />
      {/* Cage */}
      <g stroke="#d1d5db" strokeWidth="3" fill="none" opacity="0.95">
        {/* Vertical bars */}
        {Array.from({ length: 7 }).map((_, i) => (
          <line
            key={`v${i}`}
            x1={130 + i * 23}
            y1={170}
            x2={130 + i * 23}
            y2={290}
          />
        ))}
        {/* Horizontal bars */}
        {Array.from({ length: 5 }).map((_, i) => (
          <path
            key={`h${i}`}
            d={`M 110 ${190 + i * 22} Q 200 ${202 + i * 22} 290 ${190 + i * 22}`}
          />
        ))}
      </g>
      {/* Chin */}
      <ellipse cx="200" cy="310" rx="100" ry="14" fill={accent} opacity="0.7" />
    </svg>
  );
}

function AccessoryIllustration({ color, accent }: IProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="tape-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.65" />
        </linearGradient>
      </defs>
      {/* Tape roll — side */}
      <g>
        <ellipse cx="200" cy="150" rx="120" ry="36" fill="url(#tape-grad)" />
        <rect x="80" y="150" width="240" height="100" fill="url(#tape-grad)" />
        <ellipse cx="200" cy="250" rx="120" ry="36" fill={color} opacity="0.9" />
        {/* Core hole */}
        <ellipse cx="200" cy="150" rx="48" ry="14" fill={accent} opacity="0.75" />
        <ellipse cx="200" cy="250" rx="48" ry="14" fill="#0b0f16" opacity="0.85" />
        {/* Tape edge lines */}
        {Array.from({ length: 6 }).map((_, i) => (
          <ellipse
            key={i}
            cx="200"
            cy={164 + i * 14}
            rx={120}
            ry={2}
            fill="#000"
            opacity="0.08"
          />
        ))}
      </g>
      {/* Label band */}
      <rect x="80" y="192" width="240" height="24" fill={accent} opacity="0.55" />
      <text
        x="200"
        y="210"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, Arial Black, sans-serif"
        fontWeight="900"
        fontSize="18"
        fill="#f3f4f6"
      >
        CHEAP SHOT
      </text>
    </svg>
  );
}
