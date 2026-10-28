"use client";

import { IProject } from "@mooncellar/schemas";
import {
  useDeleteProjectMutation,
  useUpdateProjectMutation,
} from "@/src/lib/entities/project/api";
import { Box } from "@/src/lib/shared/ui/Box";
import { ConfirmModal } from "@/src/lib/shared/ui/ConfirmModal";
import { modal } from "@/src/lib/shared/ui/Modal";
import { toast } from "@/src/lib/shared/utils/toast.utils";
import { ProjectForm } from "./ProjectForm";
import { ProjectTokens } from "./ProjectTokens";

const EDIT_MODAL_ID = "status-project-edit";
const TOKENS_MODAL_ID = "status-project-tokens";
const CONFIRM_MODAL_ID = "status-project-confirm";

/** Edit, tokens and delete of one project — the same modals in Manage projects and on its page. */
export const useProjectActions = () => {
  const { mutateAsync: update } = useUpdateProjectMutation();
  const { mutateAsync: remove } = useDeleteProjectMutation();

  const openEdit = (project: IProject) =>
    modal.open(
      <Box
        title={`Edit ${project.name}`}
        isTitleStart
        onClose={() => modal.close(EDIT_MODAL_ID)}
        wrapperStyle={{ width: "var(--status-edit-modal-width)" }}
      >
        <ProjectForm
          project={project}
          isPending={false}
          submitText="Save"
          onCancel={() => modal.close(EDIT_MODAL_ID)}
          onSubmit={({ name, blocks, defaultBlock }) =>
            update({
              slug: project.slug,
              dto: { name, blocks, defaultBlock },
            }).then(() => {
              modal.close(EDIT_MODAL_ID);
              toast.success({ description: `${name} saved` });
            })
          }
        />
      </Box>,
      { id: EDIT_MODAL_ID }
    );

  const openTokens = (slug: string) =>
    modal.open(
      <ProjectTokens
        slug={slug}
        onClose={() => modal.close(TOKENS_MODAL_ID)}
      />,
      { id: TOKENS_MODAL_ID }
    );

  const askRemove = (project: IProject, onRemoved?: () => void) =>
    modal.open(
      <ConfirmModal
        title="Delete project"
        message={`Delete ${project.name} with everything it uploaded and its plan?`}
        warning="Its tokens stop working and the plan's tasks and history are gone. A new project with the same address starts empty."
        confirmText="Delete"
        onCancel={() => modal.close(CONFIRM_MODAL_ID)}
        onConfirm={async () => {
          await remove(project.slug);
          modal.close(CONFIRM_MODAL_ID);
          toast.success({ description: `${project.name} deleted` });
          onRemoved?.();
        }}
      />,
      { id: CONFIRM_MODAL_ID }
    );

  return { openEdit, openTokens, askRemove };
};
