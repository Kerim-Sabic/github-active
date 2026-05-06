import type { CSSProperties } from "react";
import { cn } from "@/shared/utils/cn";

const COLUMNS = 90;
const ROWS = 7;
const TOTAL = COLUMNS * ROWS;

const cells = Array.from({ length: TOTAL }, (_, index) => {
  const week = Math.floor(index / ROWS);
  const day = index % ROWS;
  const wave = (week * 13 + day * 19 + Math.floor(week / 4) * 7) % 41;

  let level: 0 | 1 | 2 | 3 | 4 = 0;
  if (wave > 33) level = 4;
  else if (wave > 26) level = 3;
  else if (wave > 18) level = 2;
  else if (wave > 9) level = 1;

  return { index, level, delay: ((index * 17) % 47) * 80 };
});

export function ActivityBackdrop({ className }: { className?: string }) {
  return (
    <div className={cn("activity-backdrop", className)} aria-hidden="true">
      <div className="activity-grid">
        {cells.map((cell) => (
          <span
            key={cell.index}
            className={`activity-tile activity-tile-${cell.level}`}
            style={{ "--activity-delay": `${cell.delay}ms` } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}
