import type { CSSProperties } from "react";
import { cn } from "@/shared/utils/cn";

type ActivityBackdropProps = {
  className?: string;
  density?: "hero" | "console";
};

const heroCells = Array.from({ length: 260 }, (_, index) => index);
const consoleCells = Array.from({ length: 180 }, (_, index) => index);

export function ActivityBackdrop({ className, density = "hero" }: ActivityBackdropProps) {
  const cells = density === "hero" ? heroCells : consoleCells;

  return (
    <div className={cn("activity-backdrop", density === "console" && "activity-backdrop-console", className)} aria-hidden="true">
      <div className="activity-backdrop-grid">
        {cells.map((cell) => {
          const level = getActivityLevel(cell);
          return (
            <span
              key={cell}
              className={`activity-tile activity-tile-${level}`}
              style={
                {
                  "--activity-delay": `${(cell % 41) * 92}ms`,
                  "--activity-duration": `${4200 + (cell % 13) * 160}ms`
                } as CSSProperties
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function getActivityLevel(index: number): 0 | 1 | 2 | 3 | 4 {
  const signal = (index * 17 + Math.floor(index / 7) * 11) % 29;
  if (signal > 25) return 4;
  if (signal > 20) return 3;
  if (signal > 14) return 2;
  if (signal > 8) return 1;
  return 0;
}
