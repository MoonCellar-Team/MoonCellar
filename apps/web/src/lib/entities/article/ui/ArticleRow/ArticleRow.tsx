import { FC } from "react";
import Image from "next/image";
import Link from "next/link";
import { IArticleListItem } from "@mooncellar/schemas";
import { Badge } from "@/src/lib/shared/ui/Badge";
import { Cover } from "@/src/lib/shared/ui/Cover";
import { Skeleton } from "@/src/lib/shared/ui/Skeleton";
import { useHideAdult } from "@/src/lib/shared/hooks/useHideAdult";
import {
  ARTICLE_TYPE_LABELS,
  formatArticleDate,
  getArticleHref,
  getArticleImage,
  isArticleMediaHidden,
} from "@/src/lib/entities/article/model";
import styles from "./ArticleRow.module.scss";

interface IArticleRowProps {
  article: IArticleListItem;
  isPriority?: boolean;
}

export const ArticleRow: FC<IArticleRowProps> = ({ article, isPriority }) => {
  const isAdultHidden = useHideAdult();
  const image = getArticleImage(article, isAdultHidden);
  const isMediaHidden = isArticleMediaHidden(article, isAdultHidden);

  return (
    <Link href={getArticleHref(article.slug)} className={styles.row}>
      <div className={styles.row__thumb}>
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 500px) 96px, 176px"
            priority={isPriority}
            className={styles.row__image}
          />
        ) : (
          <Cover isWithoutText className={styles.row__placeholder} />
        )}
      </div>
      <div className={styles.row__body}>
        {article.game ? (
          <span className={styles.row__game}>
            <span className={styles.row__gameCover}>
              {!!article.game.cover && !isMediaHidden && (
                <Image src={article.game.cover} alt="" fill sizes="14px" />
              )}
            </span>
            {article.game.name}
          </span>
        ) : (
          <Badge tone="muted">{ARTICLE_TYPE_LABELS.news}</Badge>
        )}
        <h2 className={styles.row__title}>{article.title}</h2>
        <p className={styles.row__summary}>{article.summary}</p>
        <p className={styles.row__meta}>
          {[
            formatArticleDate(article.publishedAt),
            `${article.readingMinutes} min read`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
};

export const ArticleRowSkeleton: FC = () => (
  <div className={styles.row}>
    <div className={styles.row__thumb}>
      <Skeleton height="100%" radius="inherit" />
    </div>
    <div className={styles.row__body}>
      <span className={styles.row__game}>
        <Skeleton shape="text" width="var(--padding-x14)" />
      </span>
      <h2 className={`${styles.row__title} ${styles.row__title_skeleton}`}>
        <Skeleton shape="text" count={2} gap="0" width="85%" />
      </h2>
      <p className={`${styles.row__summary} ${styles.row__summary_skeleton}`}>
        <Skeleton shape="text" count={2} gap="0" />
      </p>
      <p className={styles.row__meta}>
        <Skeleton shape="text" width="var(--padding-x25)" />
      </p>
    </div>
  </div>
);
