"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { AUSTRALIA_CLIMATE } from "@/lib/climate-scenario";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => {
  const p = clamp(n);
  return p * p * (3 - 2 * p);
};
const PHASES = ["Coffee bean", "Latte", "Spent grounds"];
const DURATION = 16000;
// Uniform SVG scaling preserves artwork proportions. The falling-particle
// geometry uses this same scale so grounds begin at the visible pile's position.
const OBJECT_SCALE = 1.06;
const CRUMBS = Array.from({ length: 72 }, (_, i) => ({
  x: Number((Math.cos(i * 2.399) * (10 + (i % 11) * 6)).toFixed(3)),
  y: Number((Math.sin(i * 2.399) * (3 + (i % 7) * 3)).toFixed(3)),
  size: 2 + (i % 4),
  destination: i % 6,
  delay: (i % 9) * 0.009,
}));
type FallGeometry = {
  width: number;
  height: number;
  x: number;
  y: number;
  scale: number;
  targets: { x: number; y: number }[];
};

export function Bean({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="-75 -105 150 210" className={className} aria-hidden="true">
      <path
        d="M-9-98C45-106 76-50 66 14S17 109-27 98C-73 87-80 28-60-34S-36-91-9-98Z"
        fill="currentColor"
      />
      <path
        d="M16-84C-37-30 27 12-23 82"
        fill="none"
        stroke="var(--bean-seam, #f0c29b)"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Latte() {
  return (
    <g className="journey-latte-art">
      <ellipse cx="6" cy="82" rx="87" ry="14" fill="#102d24" opacity=".4" />
      <path
        d="M59-30C118-52 120 38 70 39"
        fill="none"
        stroke="#d9cfbb"
        strokeWidth="18"
      />
      <path
        d="M-68-37C-66 5-60 65-28 76H28C60 65 65 4 68-37Z"
        fill="url(#cupCeramic)"
      />
      <path
        d="M-51-13C-50 12-46 42-29 53"
        stroke="#fff7e1"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        opacity=".45"
      />
      <ellipse cy="-37" rx="68" ry="30" fill="#f5e5c4" />
      <ellipse cy="-37" rx="58" ry="23" fill="#aa6e3b" />
      <ellipse cy="-37" rx="52" ry="19" fill="#c18c52" />
      <g fill="#f6e4bc" transform="translate(0 -35) scale(1 .58)">
        <path d="M0 26C-55-7-44-48-15-33C-4-27 0-12 0-12S4-27 15-33C44-48 55-7 0 26Z" />
        <path
          d="M0 9C-33-7-30-28-13-19C-4-13 0-6 0-6S4-13 13-19C30-28 33-7 0 9Z"
          fill="#b88147"
        />
        <path d="M0-8C-17-17-12-29 0-22C12-29 17-17 0-8Z" />
      </g>
      <g
        fill="none"
        stroke="#e5d6b5"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".45"
      >
        <path d="M-22-85C-40-104-9-106-24-122" />
        <path d="M15-87C-1-102 26-111 14-128" />
      </g>
    </g>
  );
}

/**
 * Two independent progress values drive the journey: a repeating coffee cycle
 * at the top and reversible scroll descent toward the workspace circles.
 * Scrolling freezes the cycle, blends it into grounds and carries them downward.
 * Reduced-motion preferences disable both automatic and scroll-driven movement.
 */
export function CoffeeStory({
  onEnter,
  onViewImpact,
  metrics,
}: {
  onEnter: () => void;
  onViewImpact: () => void;
  metrics: ReactNode;
}) {
  const [motion, setMotion] = useState({ cycle: 0, descent: 0 });
  const [inView, setInView] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [geometry, setGeometry] = useState<FallGeometry | null>(null);
  const entry = useRef<HTMLDivElement>(null);
  const scene = useRef<SVGSVGElement>(null);
  const current = useRef({ cycle: 0, descent: 0 });
  const scrollTarget = useRef(0);
  const scrollRange = useRef({ start: 0, end: 800 });
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(media.matches);
    };
    update();
    media.addEventListener("change", update);
    const observer = new IntersectionObserver(([item]) =>
      setInView(item.isIntersecting),
    );
    if (entry.current) observer.observe(entry.current);
    return () => {
      media.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      const box = entry.current?.getBoundingClientRect();
      const orbit = scene.current?.getBoundingClientRect();
      if (!box || !orbit) return;
      const engine = document.getElementById("engine")?.getBoundingClientRect();
      const dock = document
        .querySelector(".engine-dock")
        ?.getBoundingClientRect();
      const targets = Array.from(
        document.querySelectorAll<HTMLElement>(".stage-node .node-icon"),
      ).map((node) => {
        const target = node.getBoundingClientRect();
        // Reconstruct targets relative to the engine before the dock sticks.
        // Mixing sticky viewport coordinates with SVG coordinates makes particles drift.
        return {
          x: target.left - box.left + target.width / 2,
          y:
            (engine?.top ?? dock?.top ?? box.top) -
            box.top +
            target.top -
            (dock?.top ?? box.top) +
            target.height / 2,
        };
      });
      const scale = Math.min(orbit.width / 640, orbit.height / 450);
      const masthead =
        document.querySelector(".nile-masthead")?.clientHeight ?? 84;
      const absoluteTop = box.top + window.scrollY;
      const arrivalY =
        absoluteTop +
        (targets.length
          ? targets.reduce((sum, target) => sum + target.y, 0) / targets.length
          : box.height);
      const start = Math.max(0, absoluteTop - masthead - 22);
      scrollRange.current = {
        start,
        end: Math.max(
          start + 320,
          Math.min(
            document.documentElement.scrollHeight - window.innerHeight,
            arrivalY - window.innerHeight * 0.6,
          ),
        ),
      };
      scrollTarget.current = clamp(
        (window.scrollY - scrollRange.current.start) /
          (scrollRange.current.end - scrollRange.current.start),
      );
      setGeometry({
        width: box.width,
        height: Math.max(box.height + 220, ...targets.map((t) => t.y + 45)),
        x: orbit.left - box.left + orbit.width / 2,
        y: orbit.top - box.top + orbit.height / 2 + 135 * scale,
        scale: scale * OBJECT_SCALE,
        targets,
      });
    };
    frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    if (entry.current) observer.observe(entry.current);
    const dock = document.querySelector(".engine-dock");
    if (dock) observer.observe(dock);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    if (reducedMotion) return;
    const scroll = () => {
      const { start, end } = scrollRange.current;
      scrollTarget.current = clamp((window.scrollY - start) / (end - start));
    };
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", scroll);
    };
  }, [reducedMotion]);
  useEffect(() => {
    if (!inView || reducedMotion) return;
    let frame = 0,
      previous = 0;
    const tick = (time: number) => {
      const delta = previous ? Math.min(time - previous, 64) : 0;
      previous = time;
      const target = scrollTarget.current;
      // Smooth descent by elapsed time, not frame count, so scrolling feels
      // consistent at different refresh rates and can reverse without jumping.
      const nextDescent =
        current.current.descent +
        (target - current.current.descent) * (1 - Math.exp(-delta / 65));
      const descent =
        Math.abs(target - nextDescent) < 0.0001 ? target : nextDescent;
      const cycle =
        // Phase thresholds use [0, 0.75); traverse that range once per DURATION.
        target === 0 && descent === 0
          ? (current.current.cycle + (delta / DURATION) * 0.75) % 0.75
          : current.current.cycle;
      if (
        cycle !== current.current.cycle ||
        descent !== current.current.descent
      ) {
        current.current = { cycle, descent };
        setMotion(current.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reducedMotion]);
  const cycle = motion.cycle;
  const descent = motion.descent;
  const conversion = ease(descent / 0.18);
  const fall = ease((descent - 0.18) / 0.82);
  const angle = -Math.PI / 2 + (cycle / 0.75) * Math.PI * 2;
  const orbitX = Number(
    (320 + Math.cos(angle) * 170 * (1 - conversion)).toFixed(3),
  );
  const orbitY = Number(
    (235 + Math.sin(angle) * 125 * (1 - conversion) + 125 * conversion).toFixed(
      3,
    ),
  );
  const restart = ease((cycle - 0.67) / 0.08);
  const beanOpacity =
    (1 - ease((cycle - 0.21) / 0.1) + restart) * (1 - conversion);
  const latteOpacity =
    ease((cycle - 0.21) / 0.1) *
    (1 - ease((cycle - 0.47) / 0.1)) *
    (1 - conversion);
  const groundsOpacity =
    ease((cycle - 0.47) / 0.1) * (1 - restart) * (1 - conversion) + conversion;
  const phase =
    conversion > 0.5 || fall > 0
      ? 2
      : cycle < 0.26 || cycle > 0.71
        ? 0
        : cycle < 0.52
          ? 1
          : 2;
  return (
    <div
      className="coffee-entry"
      ref={entry}
      data-scroll-progress={descent.toFixed(3)}
      data-cycle-progress={cycle.toFixed(3)}
      data-coffee-phase={PHASES[phase]}
      data-journey-mode={
        reducedMotion ? "paused" : descent > 0 ? "scroll" : "loop"
      }
      style={{ "--coffee-descent": descent } as CSSProperties}
    >
      <section
        className="coffee-story orbit-story"
        id="story"
        aria-labelledby="story-title"
      >
        <div className="story-topline">
          <span>
            <i /> COFFEE INTO CLIMATE ACTION
          </span>
          <a
            href={AUSTRALIA_CLIMATE.cop31Source}
            target="_blank"
            rel="noreferrer"
          >
            COP31 · HALVE WASTE GROWTH BY 2035 <ArrowUpRight size={10} />
          </a>
        </div>
        <div className="orbit-introduction">
          <nav className="story-priorities" aria-label="COP31 priorities">
            {[
              "Zero Waste & Methane Reduction",
              "Green Industrialisation",
              "Awareness",
            ].map((priority) => (
              <button
                key={priority}
                type="button"
                className="story-kicker"
                onClick={onViewImpact}
                title="View Network impact"
              >
                {priority} <ArrowUpRight size={11} aria-hidden="true" />
              </button>
            ))}
          </nav>
          <h1 id="story-title">
            Less coffee waste. <em>Less methane.</em>
          </h1>
          <p>
            Nile matches surplus beans and coffee by-products with people who
            can use them.
            <br /> Keep materials in circulation. Help cut landfill methane.
          </p>
        </div>
        <div className="orbit-scene">
          <svg
            viewBox="0 0 640 450"
            className="coffee-journey"
            ref={scene}
            role="img"
            aria-label="A revolving coffee journey transforms from a bean to a latte to spent grounds. The grounds fall toward the workspace’s clickable circles."
          >
            <defs>
              <radialGradient id="beanGlow">
                <stop stopColor="#dbac75" stopOpacity=".15" />
                <stop offset="1" stopColor="#dbac75" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="coffeeBrown" x1="0" x2="1" y1="0" y2="1">
                <stop stopColor="#d49a61" />
                <stop offset=".4" stopColor="#a3663f" />
                <stop offset="1" stopColor="#503222" />
              </linearGradient>
              <linearGradient id="cupCeramic" x1="0" x2="1">
                <stop stopColor="#aeb7a4" />
                <stop offset=".4" stopColor="#f3e8d2" />
                <stop offset="1" stopColor="#c4cbb9" />
              </linearGradient>
              <filter
                id="coffeeShadow"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feDropShadow
                  dx="5"
                  dy="13"
                  stdDeviation="10"
                  floodColor="#0d261d"
                  floodOpacity=".5"
                />
              </filter>
            </defs>
            <circle
              cx="320"
              cy="235"
              r="219"
              fill="url(#beanGlow)"
              opacity={1 - conversion}
            />
            <g fill="none" stroke="#c9d6b8" opacity={1 - conversion}>
              <ellipse
                cx="320"
                cy="235"
                rx="207"
                ry="154"
                strokeOpacity=".22"
              />
              <ellipse
                cx="320"
                cy="235"
                rx="252"
                ry="76"
                transform="rotate(-18 320 235)"
                strokeOpacity=".15"
              />
              <ellipse
                cx="320"
                cy="235"
                rx="100"
                ry="176"
                transform="rotate(38 320 235)"
                strokeOpacity=".1"
                strokeDasharray="2 7"
              />
            </g>
            <g fill="#dca267" opacity={0.6 * (1 - conversion)}>
              <circle cx="124" cy="185" r="3" />
              <circle cx="513" cy="304" r="3" />
              <circle cx="402" cy="94" r="2" />
            </g>
            <g
              className="orbit-object"
              transform={`translate(${orbitX} ${orbitY}) scale(${OBJECT_SCALE})`}
              filter="url(#coffeeShadow)"
            >
              <g
                className="journey-main-bean"
                opacity={beanOpacity}
                transform={`rotate(${-18 + Math.sin(angle) * 12}) scale(0.56)`}
              >
                <path
                  d="M-9-98C45-106 76-50 66 14S17 109-27 98C-73 87-80 28-60-34S-36-91-9-98Z"
                  fill="url(#coffeeBrown)"
                />
                <path
                  d="M-10-86C-45-55-65 3-52 51"
                  fill="none"
                  stroke="#e4af73"
                  strokeOpacity=".6"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
                <path
                  d="M16-84C-37-30 27 12-23 82"
                  fill="none"
                  stroke="#4e3022"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  d="M19-83C-34-28 30 14-20 82"
                  fill="none"
                  stroke="#e1a56b"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </g>
              <g className="journey-latte" opacity={latteOpacity}>
                <Latte />
              </g>
              <g
                className="journey-grounds"
                opacity={groundsOpacity * (1 - ease(fall / 0.2))}
              >
                <ellipse cy="18" rx="93" ry="16" fill="#103228" opacity=".4" />
                <path
                  d="M-83 3Q-58-27-19-31Q23-44 73-5L86 13Q0 40-87 13Z"
                  fill="#815136"
                />
                <path
                  d="M-79 5Q-36-28 6-23Q45-23 78 9"
                  fill="none"
                  stroke="#b7814a"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {CRUMBS.map((c, i) => (
                  <circle
                    key={i}
                    cx={c.x}
                    cy={c.y}
                    r={c.size}
                    fill={i % 3 === 0 ? "#d0a067" : "#a36b3e"}
                  />
                ))}
              </g>
            </g>
            <g
              fill="#e6c395"
              fontFamily="Georgia, serif"
              fontSize="17"
              textAnchor="middle"
              opacity={1 - Math.max(conversion, fall)}
            >
              <text x="320" y="244">
                {PHASES[phase]}
              </text>
              <text
                x="320"
                y="266"
                fontFamily="sans-serif"
                fontSize="7"
                letterSpacing="2"
              >
                0{phase + 1} / 03
              </text>
            </g>
          </svg>
        </div>
        {metrics}
        <div className="story-bottomline">
          <span>SAMPLE DATA. REAL WORKING FLOW.</span>
          <button onClick={onEnter}>
            FOLLOW THE GROUNDS <ArrowDown size={14} />
          </button>
        </div>
      </section>
      <div className="grounds-descent">
        <span className="descent-caption">
          From coffee waste
          <br />
          <em>to climate action.</em>
        </span>
        <div className="descent-line" />
        <button className="descent-cta" onClick={onEnter}>
          Choose a circle. Open your workspace. <ArrowUpRight size={16} />
        </button>
      </div>
      {geometry && (
        <svg
          className="falling-grounds"
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          style={{ height: geometry.height }}
          aria-hidden="true"
          data-fall-progress={fall.toFixed(2)}
        >
          {CRUMBS.map((c, i) => {
            const travel = ease((fall - c.delay) / (1 - c.delay));
            const target = geometry.targets[c.destination] ?? {
              x: geometry.width / 2,
              y: geometry.height - 70,
            };
            const x =
              geometry.x +
              c.x * geometry.scale +
              (target.x - geometry.x - c.x * geometry.scale) * travel +
              Math.sin(travel * Math.PI) * Math.sin(i * 3) * 45;
            const y =
              geometry.y +
              c.y * geometry.scale +
              (target.y - geometry.y - c.y * geometry.scale) * travel;
            return (
              <circle
                key={i}
                className="falling-ground"
                cx={Number(x.toFixed(3))}
                cy={Number(y.toFixed(3))}
                r={c.size * Math.max(geometry.scale, 0.65) * (1 - travel * 0.3)}
                fill={i % 4 === 0 ? "#cf9356" : "#7b5134"}
                opacity={
                  ease(fall / 0.06) * (1 - ease((travel - 0.92) / 0.08)) * 0.95
                }
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}
