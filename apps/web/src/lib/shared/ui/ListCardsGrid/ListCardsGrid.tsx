import { Children, FC, ReactNode } from "react";
import classNames from "classnames";
import { useGridRows } from "@/src/lib/shared/hooks/useGridRows";
import styles from "./ListCardsGrid.module.scss";

interface IListCardsGridProps {
  children: ReactNode;
  maxRows?: number;
  isGameSized?: boolean;
  isDense?: boolean;
  isLoading?: boolean;
  className?: string;
}

export const ListCardsGrid: FC<IListCardsGridProps> = ({
  children,
  maxRows,
  isGameSized,
  isDense,
  isLoading,
  className,
}) => {
  const items = Children.toArray(children);
  const { ref, visibleCount } = useGridRows<HTMLDivElement>(
    items.length,
    maxRows
  );

  return (
    <div
      className={classNames(styles.wrapper, className, {
        [styles.wrapper_dense]: isDense,
      })}
    >
      <div
        ref={ref}
        className={classNames(styles.grid, {
          [styles.grid_gameSized]: isGameSized,
          [styles.grid_dense]: isDense,
          [styles.grid_twoRows]: isGameSized && maxRows === 2,
        })}
        role={isLoading ? "status" : undefined}
        aria-label={isLoading ? "Loading" : undefined}
      >
        {items.map((item, index) =>
          index < visibleCount ? (
            item
          ) : (
            <div key={index} hidden>
              {item}
            </div>
          )
        )}
      </div>
    </div>
  );
};
