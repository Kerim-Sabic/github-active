import type { CSSProperties } from "react";
import { cn } from "@/shared/utils/cn";

type ActivityBackdropProps = {
  className?: string;
  density?: "hero" | "console";
};

const heroCells = Array.from({ length: 7 * 46 }, (_, index) => index);
const consoleCells = Array.from({ length: 7 * 34 }, (_, index) => index);
const satelliteCells = Array.from({ length: 7 * 18 }, (_, index) => index);

export function ActivityBackdrop({ className, density = "hero" }: ActivityBackdropProps) {
  const cells = density === "hero" ? heroCells : consoleCells;

  return (
    <div className={cn("activity-backdrop", density === "console" && "activity-backdrop-console", className)} aria-hidden="true">
      <ContributionBoard cells={cells} className="activity-board-primary" offset={0} />
      <ContributionBoard cells={satelliteCells} className="activity-board-secondary" offset={9} />
    </div>
  );
}

function ContributionBoard({
  cells,
  className,
  offset
}: {
  cells: number[];
  className: string;
  offset: number;
}) {
  return (
    <div className={cn("activity-board", className)}>
      <div className="activity-board-chrome">
        {Array.from({ length: 3 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className="activity-backdrop-grid">
        {cells.map((cell) => {
          const level = getActivityLevel(cell + offset);
          return (
            <span
              key={cell}
              className={`activity-tile activity-tile-${level}`}
              style={
                {
                  "--activity-delay": `${((cell + offset) % 47) * 86}ms`,
                  "--activity-duration": `${5200 + ((cell + offset) % 17) * 180}ms`
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
  const week = Math.floor(index / 7);
  const day = index % 7;
  const wave = (week * 13 + day * 19 + Math.floor(week / 4) * 7) % 37;
  const cluster = week % 9 === 0 || (week > 22 && week < 30 && day > 1 && day < 6);

  if (cluster && wave > 9) return 4;
  if (wave > 30) return 4;
  if (wave > 23) return 3;
  if (wave > 15) return 2;
  if (wave > 7) return 1;
  return 0;
}
