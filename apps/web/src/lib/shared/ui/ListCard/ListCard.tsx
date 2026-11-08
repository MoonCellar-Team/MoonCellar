import { FC, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import classNames from "classnames";
import { ICustomList } from "@mooncellar/schemas";
import { commonUtils } from "@/src/lib/shared/utils/common.utils";
import { getListHref } from "@/src/lib/shared/utils/links.utils";
import { Highlight } from "../Highlight";
import { Skeleton } from "../Skeleton";
import { SvgHeartFilled, SvgLock } from "../svg";
import styles from "./ListCard.module.scss";

interface IListCardProps {
  list: ICustomList;
  layout?: "tile" | "row";
  query?: string;
  isWithAuthor?: boolean;
  isWithDate?: boolean;
  authorLabel?: string;
  className?: string;
  onClick?: () => void;
}

const MOSAIC_SIZE = 4;

const MosaicCell: FC<{ src: string; sizes: string }> = ({ src, sizes }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <span
      className={classNames(styles.mosaic__cell, styles.mosaic__cell_image, {
        [styles.mosaic__cell_loaded]: isLoaded,
      })}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        className={classNames(styles.mosaic__image, {
          [styles.mosaic__image_loaded]: isLoaded,
        })}
        onLoad={() => setIsLoaded(true)}
      />
    </span>
  );
};

export const ListMosaic: FC<{
  covers: string[];
  className?: string;
  sizes?: string;
}> = ({ covers, className, sizes = "120px" }) => (
  <span className={classNames(styles.mosaic, className)} aria-hidden="true">
    {Array.from({ length: MOSAIC_SIZE }, (_, i) =>
      covers[i] ? (
        <MosaicCell key={covers[i] + i} src={covers[i]} sizes={sizes} />
      ) : (
        <span
          key={i}
          className={classNames(styles.mosaic__cell, styles.mosaic__cell_empty)}
        />
      )
    )}
  </span>
);

export const ListCard: FC<IListCardProps> = ({
  list,
  layout = "tile",
  query,
  isWithAuthor = true,
  isWithDate = true,
  authorLabel,
  className,
  onClick,
}) => {
  const byline = authorLabel ?? (isWithAuthor ? list.author?.userName : undefined);

  const isDescriptionMatch =
    !!query?.trim() &&
    !list.name.toLowerCase().includes(query.trim().toLowerCase()) &&
    list.description.toLowerCase().includes(query.trim().toLowerCase());

  const meta = [
    `${list.gamesCount} ${commonUtils.addLastS("game", list.gamesCount)}`,
    isWithDate ? commonUtils.getHumanDate(list.updatedAt) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  if (layout === "row") {
    return (
      <Link
        href={getListHref(list)}
        className={classNames(styles.row, className)}
        onClick={onClick}
      >
        <ListMosaic
          covers={list.covers}
          className={styles.row__mosaic}
          sizes="44px"
        />
        <span className={styles.row__body}>
          <span className={styles.name}>
            <Highlight text={list.name} query={query} />
            {list.isPrivate && (
              <SvgLock size="12" className={styles.lock} aria-label="Private" />
            )}
          </span>
          {!!byline && <span className={styles.author}>{byline}</span>}
          <span className={styles.meta}>
            {isDescriptionMatch ? (
              <span className={styles.description}>
                <Highlight text={list.description} query={query} />
              </span>
            ) : (
              <>
                {meta}
                {list.likesCount > 0 && " · "}
                {list.likesCount > 0 && (
                  <span
                    className={styles.likes}
                    aria-label={`${list.likesCount} likes`}
                  >
                    <span className={styles.likes__icon}>
                      <SvgHeartFilled size="12" style={{ color: "inherit" }} />
                    </span>
                    {list.likesCount}
                  </span>
                )}
              </>
            )}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={getListHref(list)}
      className={classNames(styles.tile, className)}
      onClick={onClick}
    >
      <span className={styles.tile__art}>
        <ListMosaic
          covers={list.covers}
          sizes="(max-width: 500px) 45vw, 220px"
        />
        <span className={styles.tile__count}>{list.gamesCount}</span>
      </span>
      <span className={styles.name}>
        <Highlight text={list.name} query={query} />
        {list.isPrivate && (
          <SvgLock size="12" className={styles.lock} aria-label="Private" />
        )}
      </span>
      {!!byline || list.likesCount > 0 ? (
        <span className={styles.tile__byline}>
          {!!byline && <span className={styles.tile__author}>{byline}</span>}
          {!!byline && list.likesCount > 0 && (
            <span aria-hidden="true">·</span>
          )}
          {list.likesCount > 0 && (
            <span
              className={styles.likes}
              aria-label={`${list.likesCount} likes`}
            >
              <span className={styles.likes__icon}>
                <SvgHeartFilled size="12" style={{ color: "inherit" }} />
              </span>
              {list.likesCount}
            </span>
          )}
        </span>
      ) : null}
      {isDescriptionMatch && (
        <span className={styles.description}>
          <Highlight text={list.description} query={query} />
        </span>
      )}
    </Link>
  );
};

export const ListCardSkeleton: FC<{ layout?: "tile" | "row" }> = ({
  layout = "tile",
}) =>
  layout === "row" ? (
    <span className={classNames(styles.row, styles.row_skeleton)}>
      <Skeleton aspectRatio="var(--cover-ratio)" radius="var(--radius-x2)" />
      <Skeleton shape="text" count={2} gap="var(--gap-x1)" />
    </span>
  ) : (
    <span className={styles.tile}>
      <Skeleton aspectRatio="var(--cover-ratio)" radius="var(--radius-x4)" />
      <Skeleton shape="text" count={2} gap="var(--gap-x1)" />
    </span>
  );
