import { FC, useState } from "react";
import { IPlanTask } from "@mooncellar/schemas";
import { ActionsMenu, IActionsMenuItem } from "@/src/lib/shared/ui/ActionsMenu";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { TextField } from "@/src/lib/shared/ui/Fields";
import { SvgMore } from "@/src/lib/shared/ui/svg";
import { getTaskActionLabels, usePlanTaskActions } from "./usePlanTaskActions";
import styles from "./PlanBlock.module.scss";

interface IPlanTaskMenuProps {
  slug: string;
  task: IPlanTask;
  sectionId: string;
}

const AssignPanel: FC<{ onAssign: (name: string) => void }> = ({
  onAssign,
}) => {
  const [name, setName] = useState("");
  return (
    <div className={styles.assign}>
      <TextField label="Who takes it" value={name} onChange={setName} />
      <Button
        color={ButtonColor.ACCENT}
        disabled={!name.trim()}
        onClick={() => onAssign(name.trim())}
      >
        Assign
      </Button>
    </div>
  );
};

export const PlanTaskMenu: FC<IPlanTaskMenuProps> = ({
  slug,
  task,
  sectionId,
}) => {
  const { run, edit, askDelete, isPending } = usePlanTaskActions(slug);
  const labels = getTaskActionLabels(task);
  const items: IActionsMenuItem[] = [
    ...(labels.take
      ? [{ label: labels.take, onClick: () => run(task, "take") }]
      : []),
    ...(task.state !== "done"
      ? [
          {
            label: "Assign to…",
            panel: {
              title: `Assign ${task.id}`,
              render: ({ close }: { close: () => void }) => (
                <AssignPanel
                  onAssign={(name) => {
                    run(task, "take", name);
                    close();
                  }}
                />
              ),
            },
          },
        ]
      : []),
    ...(labels.release
      ? [{ label: labels.release, onClick: () => run(task, "release") }]
      : []),
    ...(labels.done
      ? [{ label: labels.done, onClick: () => run(task, "done") }]
      : []),
    ...(labels.reopen
      ? [{ label: labels.reopen, onClick: () => run(task, "reopen") }]
      : []),
    { label: "Edit", onClick: () => edit(task, sectionId) },
    { label: "Delete", isDanger: true, onClick: () => askDelete(task) },
  ];

  return (
    <ActionsMenu
      items={items}
      renderTrigger={({ ref, toggle }) => (
        <Button
          ref={ref}
          color={ButtonColor.TRANSPARENT}
          isOnlyIcon
          aria-label={`Actions for ${task.id}`}
          disabled={isPending}
          onClick={toggle}
        >
          <SvgMore size="16" />
        </Button>
      )}
    />
  );
};
