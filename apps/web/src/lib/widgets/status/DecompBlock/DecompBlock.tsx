"use client";

import { FC, useMemo, useState } from "react";
import classNames from "classnames";
import { IDecompArea, IDecompBlock, IDecompUnit } from "@mooncellar/schemas";
import { formatPercent } from "@/src/lib/entities/project/model";
import { Badge } from "@/src/lib/shared/ui/Badge";
import { Box } from "@/src/lib/shared/ui/Box";
import { ProgressBar } from "@/src/lib/shared/ui/ProgressBar";
import { StatTile } from "@/src/lib/shared/ui/StatTile";
import { SvgChevron } from "@/src/lib/shared/ui/svg";
import { Table } from "@/src/lib/shared/ui/Table";
import { Tabs } from "@/src/lib/shared/ui/Tabs";
import { commonUtils } from "@/src/lib/shared/utils/common.utils";
import { FunctionMap, IFunctionMapOrder, MAP_CELL_STATES } from "./FunctionMap";
import styles from "./DecompBlock.module.scss";

type IFilesFilter = "work" | "free" | "done";

const FILE_FILTERS: { label: string; filter: IFilesFilter }[] = [
  { label: "In work", filter: "work" },
  { label: "Free", filter: "free" },
  { label: "Done", filter: "done" },
];

const isComplete = (unit: IDecompUnit) =>
  unit.functions > 0 && unit.done === unit.functions;

const matchesFilter = (unit: IDecompUnit, filter: IFilesFilter) => {
  if (filter === "done") return isComplete(unit);
  if (filter === "work") return !!unit.claimedBy || unit.pending > 0;
  return !isComplete(unit) && !unit.claimedBy;
};

const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;

const UnitState: FC<{ unit: IDecompUnit }> = ({ unit }) => {
  if (unit.claimedBy) {
    return (
      <Badge tone={isComplete(unit) ? "positive" : "accent"} isWithDot>
        {unit.claimedBy}
      </Badge>
    );
  }
  if (isComplete(unit))
    return (
      <Badge tone="positive" isWithDot>
        Done
      </Badge>
    );
  if (unit.pending > 0)
    return (
      <Badge tone="attention" isWithDot>
        Waiting to merge
      </Badge>
    );
  return (
    <Badge tone="muted" isWithDot>
      Free
    </Badge>
  );
};

interface ICategoryArea {
  area: IDecompArea;
  functions: number;
  done: number;
}

interface IDecompBlockProps {
  slug: string;
  decomp: IDecompBlock;
}

export const DecompBlock: FC<IDecompBlockProps> = ({ slug, decomp }) => {
  const [filter, setFilter] = useState<IFilesFilter>("work");
  const [mapOrder, setMapOrder] = useState<IFunctionMapOrder>("status");
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);
  const { totals } = decomp;
  const units = decomp.units.filter((unit) => matchesFilter(unit, filter));

  const { areasByCategory, orphanAreas } = useMemo(() => {
    const sums = new Map<
      string,
      Map<string, { functions: number; done: number }>
    >();

    for (const unit of decomp.units) {
      if (!unit.area) continue;

      const byArea =
        sums.get(unit.category) ??
        new Map<string, { functions: number; done: number }>();
      const areaTotals = byArea.get(unit.area) ?? { functions: 0, done: 0 };

      areaTotals.functions += unit.functions;
      areaTotals.done += unit.done;
      byArea.set(unit.area, areaTotals);
      sums.set(unit.category, byArea);
    }

    const used = new Set<string>();
    const grouped = new Map<string, ICategoryArea[]>();

    for (const [categoryId, byArea] of sums) {
      grouped.set(
        categoryId,
        decomp.areas.flatMap((area) => {
          const areaTotals = byArea.get(area.id);

          if (!areaTotals) return [];

          used.add(area.id);
          return [{ area, ...areaTotals }];
        })
      );
    }

    return {
      areasByCategory: grouped,
      orphanAreas: decomp.areas.filter((area) => !used.has(area.id)),
    };
  }, [decomp.units, decomp.areas]);

  const toggleCategory = (id: string) =>
    setCollapsedCategories((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );

  return (
    <>
      <Box>
        <div className={styles.tiles}>
          <StatTile
            label="Functions"
            value={totals.done.toLocaleString("en")}
            hint={`of ${totals.functions.toLocaleString("en")} · ${formatPercent(totals.done, totals.functions)}`}
            valueColor="var(--color-positive)"
          />
          <StatTile
            label="By bytes"
            value={formatPercent(totals.bytesDone, totals.bytes)}
            hint={`${formatBytes(totals.bytesDone)} of ${formatBytes(totals.bytes)}`}
          />
          <StatTile
            label="In work"
            value={totals.claimed}
            hint="files claimed"
          />
          <StatTile
            label="Waiting to merge"
            value={totals.pending.toLocaleString("en")}
            hint="functions in work branches"
          />
        </div>
      </Box>

      <Box
        title="Categories"
        isTitleStart
        titleAction={
          <span className={styles.hint}>functions done · by module</span>
        }
      >
        <div className={styles.categories}>
          {decomp.categories.map((category) => {
            const areas = areasByCategory.get(category.id) ?? [];
            const isOpen =
              areas.length > 0 && !collapsedCategories.includes(category.id);

            return (
              <div key={category.id} className={styles.categoryBlock}>
                <div className={styles.category}>
                  {areas.length > 0 ? (
                    <button
                      type="button"
                      className={styles.category__toggle}
                      aria-expanded={isOpen}
                      aria-controls={`category-areas-${category.id}`}
                      aria-label={`${isOpen ? "Hide" : "Show"} areas in ${category.id}`}
                      onClick={() => toggleCategory(category.id)}
                    >
                      <SvgChevron
                        size="16"
                        className={classNames(styles.category__chevron, {
                          [styles.category__chevron_open]: isOpen,
                        })}
                        style={{ color: "var(--color-text-muted)" }}
                      />
                    </button>
                  ) : (
                    <span
                      className={styles.category__toggle}
                      aria-hidden="true"
                    />
                  )}
                  <span className={styles.category__name}>{category.id}</span>
                  <ProgressBar
                    value={category.done}
                    max={Math.max(category.functions, 1)}
                    tone="positive"
                    aria-label={`${category.id}: ${category.done} of ${category.functions}`}
                  />
                  <span className={styles.category__count}>
                    {category.done.toLocaleString("en")} /{" "}
                    {category.functions.toLocaleString("en")}
                    {areas.length === 0 && (
                      <span className={styles.category__none}>
                        no areas yet
                      </span>
                    )}
                  </span>
                </div>

                <div
                  id={`category-areas-${category.id}`}
                  className={styles.category__areas}
                  hidden={!isOpen}
                >
                  <div className={styles.areasHead}>
                    <span>Area</span>
                    <span>Led by</span>
                    <span className={styles.areasDone}>Done</span>
                  </div>
                  {areas.map(({ area, functions, done }) => (
                    <div key={area.id} className={styles.areasRow}>
                      <span>{area.title ?? area.id}</span>
                      <span className={styles.areasOwners}>
                        {area.owners.join(", ") || "—"}
                      </span>
                      <span className={styles.areasDone}>
                        {formatPercent(done, functions)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {orphanAreas.length > 0 && (
            <p className={styles.orphans}>
              No files match:{" "}
              {orphanAreas.map((area) => area.title ?? area.id).join(", ")}
            </p>
          )}
        </div>
      </Box>

      <Box
        title="Function map"
        isTitleStart
        titleAction={
          <div className={styles.mapActions}>
            <ul className={styles.legend}>
              {MAP_CELL_STATES.map(({ label, token }) => (
                <li key={label}>
                  <i style={{ backgroundColor: `var(${token})` }} />
                  {label}
                </li>
              ))}
            </ul>
            <Tabs
              theme="segmented"
              ariaLabel="Order the map"
              contents={[
                {
                  tabName: "By status",
                  onTabClick: () => setMapOrder("status"),
                },
                {
                  tabName: "By address",
                  onTabClick: () => setMapOrder("address"),
                },
              ]}
            />
          </div>
        }
      >
        <FunctionMap
          slug={slug}
          map={decomp.map}
          units={decomp.units}
          order={mapOrder}
        />
      </Box>

      <div className={styles.split}>
        <Box
          title="Files"
          isTitleStart
          titleAction={
            <Tabs
              theme="segmented"
              ariaLabel="Show files"
              contents={FILE_FILTERS.map(({ label, filter: value }) => ({
                tabName: label,
                count: decomp.units.filter((unit) => matchesFilter(unit, value))
                  .length,
                onTabClick: () => setFilter(value),
              }))}
            />
          }
        >
          <Table
            mobileHeadField="file"
            initialSortingKey="file"
            initialSortingOrder="asc"
            columnStyles={{
              file: { width: "1fr", minWidth: "200px" },
              functions: { width: "110px", minWidth: "90px" },
              state: { width: "160px", minWidth: "130px" },
            }}
            headers={{
              file: { content: "File" },
              functions: { content: "Functions" },
              state: { content: "State" },
            }}
            rows={units.map((unit) => ({
              file: {
                content: <span className={styles.file}>{unit.id}</span>,
                sortingValue: unit.id,
                title: unit.note,
              },
              functions: {
                content: `${unit.done} / ${unit.functions}`,
                sortingValue: unit.functions ? unit.done / unit.functions : 0,
              },
              state: {
                content: <UnitState unit={unit} />,
                sortingValue: unit.claimedBy ?? "",
              },
            }))}
          />
        </Box>
        <Box title="Feed" isTitleStart>
          <ul className={styles.feed}>
            {decomp.events.map((event, index) => (
              <li key={`${event.at}-${index}`} className={styles.feed__item}>
                <i
                  className={classNames(
                    styles.feed__dot,
                    styles[`feed__dot_${event.kind}`]
                  )}
                />
                <span>{event.text}</span>
                <time dateTime={event.at} className={styles.feed__time}>
                  {commonUtils.getHumanDate(event.at)}
                </time>
              </li>
            ))}
          </ul>
        </Box>
      </div>
    </>
  );
};
