import { FC } from "react";
import {
  usePlanEventsQuery,
  useProjectPlanQuery,
} from "@/src/lib/entities/project/api";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { commonUtils } from "@/src/lib/shared/utils/common.utils";
import { PlanStateBadge } from "./PlanStateBadge";
import { PlanText } from "./PlanText";
import { getTaskActionLabels, usePlanTaskActions } from "./usePlanTaskActions";
import styles from "./PlanBlock.module.scss";

const ACTION_WORDS: Record<string, string> = {
  take: "took it",
  release: "released it",
  done: "marked it done",
  reopen: "reopened it",
  create: "added it",
  edit: "edited it",
  delete: "deleted it",
  import: "imported the plan",
};

interface IPlanTaskPanelProps {
  slug: string;
  taskId: string;
}

export const PlanTaskPanel: FC<IPlanTaskPanelProps> = ({ slug, taskId }) => {
  const { data: plan } = useProjectPlanQuery(slug, true);
  const { data: events = [] } = usePlanEventsQuery(slug, taskId);
  const { run, edit, askDelete, isPending } = usePlanTaskActions(slug);
  const section = plan?.sections.find((item) =>
    item.tasks.some((task) => task.id === taskId)
  );
  const task = section?.tasks.find((item) => item.id === taskId);

  if (!plan) return null;
  if (!task || !section) {
    return <p className={styles.hint}>{taskId} is no longer in the plan.</p>;
  }

  const labels = getTaskActionLabels(task);

  return (
    <div className={styles.details}>
      <div className={styles.details__state}>
        <PlanStateBadge task={task} />
        {task.size && (
          <span className={styles.details__size}>Size {task.size}</span>
        )}
        <span className={styles.details__size}>{section.title}</span>
      </div>
      <div className={styles.details__actions}>
        {labels.take && (
          <Button
            color={ButtonColor.ACCENT}
            disabled={isPending}
            onClick={() => run(task, "take")}
          >
            {labels.take}
          </Button>
        )}
        {labels.done && (
          <Button disabled={isPending} onClick={() => run(task, "done")}>
            {labels.done}
          </Button>
        )}
        {labels.release && (
          <Button disabled={isPending} onClick={() => run(task, "release")}>
            {labels.release}
          </Button>
        )}
        {labels.reopen && (
          <Button disabled={isPending} onClick={() => run(task, "reopen")}>
            {labels.reopen}
          </Button>
        )}
        <Button
          color={ButtonColor.TRANSPARENT}
          onClick={() => edit(task, section.id)}
        >
          Edit
        </Button>
        <Button color={ButtonColor.RED} onClick={() => askDelete(task)}>
          Delete
        </Button>
      </div>
      <p className={styles.details__text}>
        <PlanText text={task.title} />
      </p>
      {task.where && (
        <div className={styles.details__fact}>
          <h4>Where</h4>
          <p>
            <PlanText text={task.where} />
          </p>
        </div>
      )}
      {!!task.depends?.length && (
        <div className={styles.details__fact}>
          <h4>Depends on</h4>
          <p>{task.depends.join(", ")}</p>
        </div>
      )}
      {task.doneWhen && (
        <div className={styles.details__fact}>
          <h4>Done when</h4>
          <p>
            <PlanText text={task.doneWhen} />
          </p>
        </div>
      )}
      {!!events.length && (
        <div className={styles.details__fact}>
          <h4>History</h4>
          <ul className={styles.history}>
            {events.map((event, index) => (
              <li key={`${event.at}-${index}`}>
                <span>
                  <strong>{event.by}</strong>{" "}
                  {ACTION_WORDS[event.action] ?? event.action}
                  {event.text && event.action === "take"
                    ? ` — ${event.text}`
                    : ""}
                </span>
                <time dateTime={event.at}>
                  {commonUtils.getHumanDate(event.at)}
                </time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
