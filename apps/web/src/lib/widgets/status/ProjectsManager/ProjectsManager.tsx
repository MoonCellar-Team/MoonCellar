"use client";

import { FC, useState } from "react";
import {
  useCreateProjectMutation,
  useProjectsQuery,
} from "@/src/lib/entities/project/api";
import {
  PROJECT_BLOCK_TITLES,
  getLastUpload,
} from "@/src/lib/entities/project/model";
import { Box } from "@/src/lib/shared/ui/Box";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { SvgPlus } from "@/src/lib/shared/ui/svg";
import { Table } from "@/src/lib/shared/ui/Table";
import { commonUtils } from "@/src/lib/shared/utils/common.utils";
import { toast } from "@/src/lib/shared/utils/toast.utils";
import { ProjectForm } from "./ProjectForm";
import { useProjectActions } from "./useProjectActions";
import styles from "./ProjectsManager.module.scss";

const tokensLabel = (count: number) =>
  count === 0 ? "No tokens" : count === 1 ? "1 token" : `${count} tokens`;

export const ProjectsManager: FC = () => {
  const { data: projects = [], isLoading } = useProjectsQuery();
  const [isCreating, setIsCreating] = useState(false);
  const { mutate: create, isPending: isCreatePending } =
    useCreateProjectMutation();
  const { openEdit, openTokens, askRemove } = useProjectActions();

  return (
    <>
      {isCreating && (
        <Box
          title="New project"
          isTitleStart
          onClose={() => setIsCreating(false)}
        >
          <ProjectForm
            isPending={isCreatePending}
            submitText="Create"
            onSubmit={(values) =>
              create(values, {
                onSuccess: (created) => {
                  setIsCreating(false);
                  toast.success({
                    description: `${created.name} created. Connect it from where it uploads, or add a token.`,
                  });
                },
              })
            }
          />
        </Box>
      )}
      <Box
        title="Projects"
        isTitleStart
        titleAction={
          !isCreating && (
            <Button
              color={ButtonColor.ACCENT}
              onClick={() => setIsCreating(true)}
            >
              <SvgPlus size="16" />
              New project
            </Button>
          )
        }
      >
        <p className={styles.hint}>
          Each machine or CI uploads with its own token. Click a row to rename a
          project or change its blocks.
        </p>
        <Table
          mobileHeadField="project"
          initialSortingKey="project"
          initialSortingOrder="asc"
          isLoading={isLoading}
          rowClickExcludeKeys={["actions"]}
          onRowClick={(index) => openEdit(projects[index])}
          columnStyles={{
            project: { width: "1fr", minWidth: "160px" },
            blocks: { width: "1fr", minWidth: "140px" },
            upload: { width: "150px", minWidth: "120px" },
            actions: { width: "230px", minWidth: "220px" },
          }}
          headers={{
            project: { content: "Project" },
            blocks: { content: "Blocks" },
            upload: { content: "Last upload" },
            actions: { content: "Tokens", isNotSortable: true },
          }}
          rows={projects.map((project) => {
            const upload = getLastUpload(project);
            return {
              project: {
                content: (
                  <span className={styles.project}>
                    <strong>{project.name}</strong>
                    <span className={styles.slug}>{project.slug}</span>
                  </span>
                ),
                sortingValue: project.name,
              },
              blocks: {
                content: project.blocks
                  .map((block) => PROJECT_BLOCK_TITLES[block])
                  .join(", "),
              },
              upload: {
                content: upload
                  ? commonUtils.getHumanDate(upload.updatedAt)
                  : "Never",
                sortingValue: upload?.updatedAt ?? "",
              },
              actions: {
                content: (
                  <span className={styles.actions}>
                    <Button onClick={() => openTokens(project.slug)}>
                      {tokensLabel(project.tokens.length)}
                    </Button>
                    <Button
                      color={ButtonColor.RED}
                      onClick={() => askRemove(project)}
                    >
                      Delete
                    </Button>
                  </span>
                ),
              },
            };
          })}
        />
      </Box>
    </>
  );
};
