"use client";

import { FC, useEffect } from "react";
import classNames from "classnames";
import Image from "next/image";
import Link from "next/link";
import {
  IArticle,
  IArticleListItem,
  IGameResponse,
  IGameStats,
} from "@mooncellar/schemas";
import {
  useAdminArticleQuery,
  useRegisterArticleViewMutation,
} from "@/src/lib/entities/article/api";
import {
  ARTICLE_TYPE_LABELS,
  formatArticleDate,
  formatArticleViews,
  getArticleHref,
  getArticleImage,
  NEWS_HREF,
} from "@/src/lib/entities/article/model";
import { ArticleLinks } from "@/src/lib/entities/article/ui/ArticleLinks";
import { ArticleComments } from "@/src/lib/widgets/news/ArticleComments";
import { ArticleGamePanel } from "@/src/lib/widgets/news/ArticleGamePanel";
import { useHideAdult } from "@/src/lib/shared/hooks/useHideAdult";
import { useIsAuthHydrated } from "@/src/lib/shared/hooks/useIsAuthHydrated";
import { useAuthStore } from "@/src/lib/shared/store/auth.store";
import { Avatar } from "@/src/lib/shared/ui/Avatar";
import { Badge } from "@/src/lib/shared/ui/Badge";
import { BGImage } from "@/src/lib/shared/ui/BGImage";
import { Box } from "@/src/lib/shared/ui/Box";
import { Breadcrumbs } from "@/src/lib/shared/ui/Breadcrumbs";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { RichText } from "@/src/lib/shared/ui/RichText";
import { SvgEye, SvgPen } from "@/src/lib/shared/ui/svg";
import styles from "./ArticlePage.module.scss";

interface IArticlePageProps {
  article: IArticle;
  game?: IGameResponse | null;
  stats?: IGameStats;
  latest?: IArticleListItem[];
}

const PANEL_STYLE = { padding: "var(--article-box-padding)" };

export const ArticlePage: FC<IArticlePageProps> = ({
  article,
  game,
  stats,
  latest,
}) => {
  const image = getArticleImage(article, useHideAdult());
  const isAuthHydrated = useIsAuthHydrated();
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const others = latest?.filter((item) => item._id !== article._id) ?? [];
  const { mutate: registerView, status: viewStatus } =
    useRegisterArticleViewMutation();
  const isViewSettled = viewStatus === "success" || viewStatus === "error";
  const { data: adminArticle } = useAdminArticleQuery(
    isAuthHydrated && isAdmin && isViewSettled ? article._id : undefined
  );

  useEffect(() => {
    registerView(article._id);
  }, [article._id, registerView]);

  return (
    <>
      <BGImage game={game ?? undefined} />
      <div className={classNames(styles.page, !game && styles.page_news)}>
        <Box
          className={styles.page__head}
          contentStyle={{ ...PANEL_STYLE, gap: "var(--gap-x3)" }}
        >
          <Breadcrumbs
            items={[
              { name: "Home", href: "/" },
              { name: "News", href: NEWS_HREF },
              { name: article.title, href: getArticleHref(article.slug) },
            ]}
          />
          <div className={styles.meta}>
            <Badge tone={article.type === "game" ? "accent" : "muted"}>
              {ARTICLE_TYPE_LABELS[article.type]}
            </Badge>
            <span>{formatArticleDate(article.publishedAt)}</span>
            <span aria-hidden="true">·</span>
            <span>{article.readingMinutes} min read</span>
            {isAuthHydrated && isAdmin && (
              <span className={styles.meta__admin}>
                {adminArticle && (
                  <span className={styles.meta__views}>
                    <SvgEye size="16" style={{ color: "inherit" }} />
                    {formatArticleViews(adminArticle.views)}
                  </span>
                )}
                <Button
                  href={`/admin/news/${article._id}`}
                  color={ButtonColor.GHOST}
                  compact
                >
                  <SvgPen size="16" style={{ color: "inherit" }} />
                  Edit post
                </Button>
              </span>
            )}
          </div>
          <h1 className={styles.title}>{article.title}</h1>
          <p className={styles.summary}>{article.summary}</p>
          {article.author && (
            <div className={styles.byline}>
              <span className={styles.byline__avatar}>
                <Avatar
                  user={{
                    _id: article.author._id,
                    userName: article.author.userName,
                    avatar: article.author.avatar ?? "",
                  }}
                  isWithoutTooltip
                />
              </span>
              <span>
                by{" "}
                <Link href={`/user/${article.author.userName}`}>
                  {article.author.userName}
                </Link>
              </span>
            </div>
          )}
        </Box>

        <aside className={styles.page__side}>
          {game ? (
            <ArticleGamePanel game={game} stats={stats} />
          ) : (
            !!others.length && (
              <Box title="Latest posts" isTitleStart>
                <ArticleLinks articles={others} />
              </Box>
            )
          )}
        </aside>

        <Box
          className={styles.page__body}
          contentStyle={{ ...PANEL_STYLE, gap: "var(--article-text-gap)" }}
        >
          {image && (
            <div className={styles.hero}>
              <Image
                src={image}
                alt=""
                fill
                priority
                sizes="(max-width: 960px) 100vw, 1036px"
                className={styles.hero__image}
              />
            </div>
          )}
          <RichText content={article.content} size="article" />
        </Box>

        <ArticleComments
          articleId={article._id}
          className={styles.page__comments}
        />
      </div>
    </>
  );
};
