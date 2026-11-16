import { FC } from "react";
import classNames from "classnames";
import styles from "./PageCrumbsSkeleton.module.scss";
import { Skeleton } from "../Skeleton";

interface IPageCrumbsSkeletonProps {
  className?: string;
}

export const PageCrumbsSkeleton: FC<IPageCrumbsSkeletonProps> = ({
  className,
}) => (
  <div className={classNames(styles.crumbs, className)}>
    <Skeleton shape="text" width="var(--page-skeleton-crumbs-width)" />
  </div>
);
