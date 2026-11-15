"use client";

import { FC, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import classNames from "classnames";
import { IProject, IProjectBlock, IProjectUpload } from "@mooncellar/schemas";
import {
  PROJECT_BLOCK_TITLES,
  formatPercent,
  getLastUpload,
  getProjectSummary,
  getProjectUpload,
  isStaleUpload,
} from "@/src/lib/entities/project/model";
import { Box } from "@/src/lib/shared/ui/Box";
import { Dropdown } from "@/src/lib/shared/ui/Dropdown";
import { Skeleton } from "@/src/lib/shared/ui/Skeleton";
import { Tooltip } from "@/src/lib/shared/ui/Tooltip";
import {
  SvgChevron,
  SvgClock,
  SvgCode,
  SvgListBullet,
  SvgSettings,
  SvgStar,
} from "@/src/lib/shared/ui/svg";
import { commonUtils } from "@/src/lib/shared/utils/common.utils";
import { useHubMenuPrefs } from "./useHubMenuPrefs";
import styles from "./ProjectsMenu.module.scss";

export const MANAGE_PROJECTS_PATH = "/manage";

interface IProjectsMenuProps {
  projects: IProject[];
  isLoading: boolean;
  current: string | null;
}

interface IMenuSection {
  key: string;
  title?: string;
  isFoldable: boolean;
  projects: IProject[];
}

const BLOCK_ICONS: Record<IProjectBlock, FC<{ size?: "16" }>> = {
  decomp: SvgCode,
  plan: SvgListBullet,
};

const MANAGE_LABEL = "Manage projects";
const UNGROUPED_TITLE = "Projects";

/**
 * Favourites first, then the named groups alphabetically, then what has no group.
 * A starred project leaves its group, so it is listed once.
 */
const buildSections = (
  projects: IProject[],
  favourites: string[]
): IMenuSection[] => {
  const isFavourite = (project: IProject) => favourites.includes(project.slug);
  const groups = new Map<string, IProject[]>();
  const ungrouped: IProject[] = [];

  for (const project of projects) {
    if (isFavourite(project)) continue;

    const group = project.group?.trim();

    if (!group) {
      ungrouped.push(project);
      continue;
    }

    groups.set(group, [...(groups.get(group) ?? []), project]);
  }

  const sections: IMenuSection[] = [];
  const starred = projects.filter(isFavourite);

  if (starred.length) {
    sections.push({
      key: "favourites",
      title: "Favourites",
      isFoldable: false,
      projects: starred,
    });
  }

  for (const [title, list] of [...groups].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    sections.push({
      key: `group:${title}`,
      title,
      isFoldable: true,
      projects: list,
    });
  }

  if (ungrouped.length) {
    sections.push({ key: "ungrouped", isFoldable: false, projects: ungrouped });
  }

  return sections.length === 1 && !sections[0].title
    ? [{ ...sections[0], title: UNGROUPED_TITLE }]
    : sections;
};

const getBlockSummary = (
  block: IProjectBlock,
  upload: IProjectUpload | undefined
) => {
  if (!upload) return "Not uploaded yet";

  return block === "decomp"
    ? `${formatPercent(upload.done, upload.total)} · ${upload.done} of ${upload.total}`
    : `${upload.done} of ${upload.total} done`;
};

const ProjectSummaryCard: FC<{ project: IProject }> = ({ project }) => {
  const lastUpload = getLastUpload(project);

  return (
    <>
      <p className={styles.card__name}>{project.name}</p>
      {project.blocks.map((block) => {
        const Icon = BLOCK_ICONS[block];

        return (
          <span key={block} className={styles.card__block}>
            <Icon size="16" />
            <span className={styles.card__label}>
              {PROJECT_BLOCK_TITLES[block]}
            </span>
            <span className={styles.card__value}>
              {getBlockSummary(block, getProjectUpload(project, block))}
            </span>
          </span>
        );
      })}
      {lastUpload ? (
        <p
          className={classNames(styles.card__foot, {
            [styles.card__foot_stale]: isStaleUpload(lastUpload),
          })}
        >
          <SvgClock size="12" />
          Updated {commonUtils.getHumanDate(lastUpload.updatedAt)}
        </p>
      ) : (
        <p className={styles.card__foot}>Nothing uploaded yet</p>
      )}
    </>
  );
};

interface IProjectsMenuRowProps {
  project: IProject;
  isCurrent: boolean;
  isFavourite: boolean;
  onToggleFavourite: (slug: string) => void;
}

const ProjectsMenuRow: FC<IProjectsMenuRowProps> = ({
  project,
  isCurrent,
  isFavourite,
  onToggleFavourite,
}) => {
  const upload = getLastUpload(project);
  const freshness = !upload
    ? styles.row__dot_never
    : isStaleUpload(upload)
      ? styles.row__dot_stale
      : styles.row__dot_fresh;

  return (
    <div
      className={classNames(styles.row, {
        [styles.row_current]: isCurrent,
      })}
    >
      <Tooltip
        position="right"
        align="start"
        className={styles.card}
        content={<ProjectSummaryCard project={project} />}
      >
        <Link
          href={`/${project.slug}`}
          aria-current={isCurrent ? "page" : undefined}
          className={styles.row__link}
        >
          <span
            className={classNames(styles.row__dot, freshness)}
            aria-hidden
          />
          <span className={styles.row__name}>{project.name}</span>
          <span className={styles.row__summary}>
            {getProjectSummary(project)}
          </span>
        </Link>
      </Tooltip>
      <button
        type="button"
        className={styles.row__star}
        aria-pressed={isFavourite}
        aria-label={
          isFavourite
            ? `Remove ${project.name} from favourites`
            : `Add ${project.name} to favourites`
        }
        onClick={() => onToggleFavourite(project.slug)}
      >
        <SvgStar size="12" fillPercent={isFavourite ? 100 : 0} />
      </button>
    </div>
  );
};

export const ProjectsMenu: FC<IProjectsMenuProps> = ({
  projects,
  isLoading,
  current,
}) => {
  const router = useRouter();
  const { favourites, toggleFavourite, folded, toggleFolded } =
    useHubMenuPrefs();
  const isManage = current === MANAGE_PROJECTS_PATH.slice(1);
  const sections = useMemo(
    () => buildSections(projects, favourites),
    [projects, favourites]
  );
  const ordered = useMemo(
    () => sections.flatMap((section) => section.projects),
    [sections]
  );
  const labels = [...ordered.map((project) => project.name), MANAGE_LABEL];
  const currentLabel = isManage
    ? MANAGE_LABEL
    : projects.find((project) => project.slug === current)?.name;

  const openIndex = (index: number) => {
    if (index < 0) return;

    router.push(
      index < ordered.length ? `/${ordered[index].slug}` : MANAGE_PROJECTS_PATH
    );
  };

  return (
    <>
      <div className={styles.menu}>
        <Box>
          <nav aria-label="Projects" className={styles.menu__nav}>
            {isLoading && (
              <Skeleton
                count={2}
                height="var(--status-menu-row-height)"
                gap="var(--gap-x05)"
              />
            )}
            {sections.map((section) => {
              const isFolded =
                section.isFoldable && folded.includes(section.key);

              return (
                <div key={section.key} className={styles.section}>
                  {section.title &&
                    (section.isFoldable ? (
                      <button
                        type="button"
                        className={styles.section__head}
                        aria-expanded={!isFolded}
                        onClick={() => toggleFolded(section.key)}
                      >
                        <SvgChevron
                          size="12"
                          className={classNames(styles.section__chevron, {
                            [styles.section__chevron_folded]: isFolded,
                          })}
                        />
                        <span>{section.title}</span>
                        <span className={styles.section__count}>
                          {section.projects.length}
                        </span>
                      </button>
                    ) : (
                      <p className={styles.section__caption}>{section.title}</p>
                    ))}
                  {!isFolded &&
                    section.projects.map((project) => (
                      <ProjectsMenuRow
                        key={project.slug}
                        project={project}
                        isCurrent={project.slug === current}
                        isFavourite={favourites.includes(project.slug)}
                        onToggleFavourite={toggleFavourite}
                      />
                    ))}
                </div>
              );
            })}
            <div className={styles.menu__separator} />
            <Link
              href={MANAGE_PROJECTS_PATH}
              aria-current={isManage ? "page" : undefined}
              className={classNames(styles.row, {
                [styles.row_current]: isManage,
              })}
            >
              <span className={styles.row__name}>{MANAGE_LABEL}</span>
              <span className={styles.row__blocks}>
                <SvgSettings size="16" />
              </span>
            </Link>
          </nav>
        </Box>
      </div>
      <div className={styles.mobile}>
        <Dropdown
          list={labels}
          overwriteValue={currentLabel}
          placeholder="Pick a project"
          getIndex={openIndex}
          isLoading={isLoading}
          isWithSearch={false}
          isThroughPortal
        />
      </div>
    </>
  );
};
