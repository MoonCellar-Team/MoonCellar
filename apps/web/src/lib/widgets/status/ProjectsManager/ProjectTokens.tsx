import { FC, useState } from "react";
import {
  useAddProjectTokenMutation,
  useProjectsQuery,
  useRevokeProjectTokenMutation,
} from "@/src/lib/entities/project/api";
import { Box } from "@/src/lib/shared/ui/Box";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { TextField } from "@/src/lib/shared/ui/Fields";
import { Table } from "@/src/lib/shared/ui/Table";
import { commonUtils } from "@/src/lib/shared/utils/common.utils";
import { ProjectTokenNotice } from "./ProjectTokenNotice";
import styles from "./ProjectsManager.module.scss";

interface IProjectTokensProps {
  slug: string;
  onClose: () => void;
}

export const ProjectTokens: FC<IProjectTokensProps> = ({ slug, onClose }) => {
  const { data: projects = [] } = useProjectsQuery();
  const project = projects.find((item) => item.slug === slug);
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const { mutate: add, isPending: isAdding } = useAddProjectTokenMutation();
  const { mutate: revoke } = useRevokeProjectTokenMutation();

  const addToken = () =>
    add(
      { slug, name: name.trim() },
      {
        onSuccess: (created) => {
          setIssued(created.token);
          setName("");
        },
      }
    );

  return (
    <Box
      title={`Upload tokens · ${project?.name ?? slug}`}
      isTitleStart
      onClose={onClose}
      isWithScrollBar
      wrapperStyle={{ width: "var(--status-edit-modal-width)" }}
    >
      <div className={styles.tokens}>
        <p className={styles.hint}>
          One token per machine or CI. The easiest way to get one is the
          project&apos;s connect command run where it uploads from: it opens
          this hub, asks you to allow it and saves its own token. Revoking a
          token stops only that machine.
        </p>
        {issued && <ProjectTokenNotice slug={slug} token={issued} />}
        <Table
          mobileHeadField="name"
          isWithoutMobileSorting
          initialSortingKey="created"
          initialSortingOrder="desc"
          columnStyles={{
            name: { width: "1fr", minWidth: "140px" },
            created: { width: "120px", minWidth: "110px" },
            used: { width: "130px", minWidth: "110px" },
            actions: { width: "96px", minWidth: "96px" },
          }}
          headers={{
            name: { content: "Name" },
            created: { content: "Added" },
            used: { content: "Last upload" },
            actions: { content: "", isNotSortable: true },
          }}
          rows={(project?.tokens ?? []).map((token) => ({
            name: { content: token.name, sortingValue: token.name },
            created: {
              content: commonUtils.getHumanDate(token.createdAt),
              sortingValue: token.createdAt,
            },
            used: {
              content: token.lastUsedAt
                ? commonUtils.getHumanDate(token.lastUsedAt)
                : "Never",
              sortingValue: token.lastUsedAt ?? "",
            },
            actions: {
              content:
                revoking === token.id ? (
                  <Button
                    color={ButtonColor.RED}
                    onClick={() => revoke({ slug, id: token.id })}
                  >
                    Sure?
                  </Button>
                ) : (
                  <Button onClick={() => setRevoking(token.id)}>Revoke</Button>
                ),
            },
          }))}
        />
        <TextField
          label="New token for"
          placeholder="CI, or user@machine"
          value={name}
          onChange={setName}
          isFlush
          action={
            <Button
              color={ButtonColor.ACCENT}
              disabled={!name.trim() || isAdding}
              isLoading={isAdding}
              onClick={addToken}
            >
              Add token
            </Button>
          }
        />
      </div>
    </Box>
  );
};
