"use client";

import { FC, ReactElement, useState } from "react";
import { IPlanBlock, IPlanSection, IPlanTaskState } from "@mooncellar/schemas";
import { useDeletePlanSectionMutation } from "@/src/lib/entities/project/api";
import { formatPercent } from "@/src/lib/entities/project/model";
import { Box } from "@/src/lib/shared/ui/Box";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { DRAWER_TRIGGER_ATTRIBUTE, drawer } from "@/src/lib/shared/ui/Drawer";
import { EmptyState } from "@/src/lib/shared/ui/EmptyState";
import { CollapsibleSection } from "@/src/lib/shared/ui/Fields";
import { modal } from "@/src/lib/shared/ui/Modal";
import { ProgressBar } from "@/src/lib/shared/ui/ProgressBar";
import { StatTile } from "@/src/lib/shared/ui/StatTile";
import { SvgListBullet, SvgPlus } from "@/src/lib/shared/ui/svg";
import { Table } from "@/src/lib/shared/ui/Table";
import { Tabs } from "@/src/lib/shared/ui/Tabs";
import { PlanSectionForm } from "./PlanSectionForm";
import { PlanStateBadge } from "./PlanStateBadge";
import { PlanTaskForm } from "./PlanTaskForm";
import { PlanTaskMenu } from "./PlanTaskMenu";
import { PlanTaskPanel } from "./PlanTaskPanel";
import { PlanText } from "./PlanText";
import styles from "./PlanBlock.module.scss";

const FILTERS: { label: string; state: IPlanTaskState | null }[] = [
  { label: "All", state: null },
  { label: "In progress", state: "taken" },
  { label: "Free", state: "free" },
  { label: "Waiting", state: "waiting" },
  { label: "Done", state: "done" },
];

const STATE_ORDER: Record<IPlanTaskState, number> = {
  taken: 0,
  free: 1,
  waiting: 2,
  done: 3,
};

const FORM_MODAL_ID = "status-plan-form";

const trigger = { [DRAWER_TRIGGER_ATTRIBUTE]: "" };

interface IPlanBlockProps {
  slug: string;
  plan: IPlanBlock;
}

export const PlanBlock: FC<IPlanBlockProps> = ({ slug, plan }) => {
  const [filter, setFilter] = useState<IPlanTaskState | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () =>
      new Set(
        plan.sections
          .filter(
            (section) =>
              section.tasks.length &&
              section.tasks.every((task) => task.state === "done")
          )
          .map((section) => section.id)
      )
  );
  const { mutate: deleteSection } = useDeletePlanSectionMutation(slug);
  const tasks = plan.sections.flatMap((section) => section.tasks);
  const count = (state: IPlanTaskState) =>
    tasks.filter((task) => task.state === state).length;
  const done = count("done");
  const owners = new Set(
    tasks.filter((task) => task.state === "taken").map((task) => task.owner)
  );
  const sections = plan.sections
    .map((section) => ({
      ...section,
      tasks: section.tasks.filter((task) => !filter || task.state === filter),
    }))
    .filter((section) => !filter || section.tasks.length);
  const isAllCollapsed = sections.every((section) => collapsed.has(section.id));

  const toggleSection = (id: string, isOpen: boolean) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (isOpen) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setCollapsed(
      isAllCollapsed
        ? new Set()
        : new Set(plan.sections.map((section) => section.id))
    );

  const openForm = (form: ReactElement) =>
    modal.open(form, { id: FORM_MODAL_ID });
  const closeForm = () => modal.close(FORM_MODAL_ID);

  const addSection = () =>
    openForm(<PlanSectionForm slug={slug} onClose={closeForm} />);

  const renameSection = (section: IPlanSection) =>
    openForm(
      <PlanSectionForm slug={slug} section={section} onClose={closeForm} />
    );

  const addTask = (sectionId: string) =>
    openForm(
      <PlanTaskForm slug={slug} sectionId={sectionId} onClose={closeForm} />
    );

  const openTask = (taskId: string) =>
    drawer.open(<PlanTaskPanel slug={slug} taskId={taskId} />, {
      title: taskId,
    });

  if (!plan.sections.length) {
    return (
      <Box>
        <EmptyState
          variant="inline"
          icon={<SvgListBullet size="24" />}
          title="The plan is empty"
          description="Add a section, then its tasks. Agents and tools can change the plan through the hub's API as well."
          action={
            <Button color={ButtonColor.ACCENT} onClick={addSection}>
              Add a section
            </Button>
          }
        />
      </Box>
    );
  }

  return (
    <>
      <Box>
        <div className={styles.summary}>
          <div className={styles.tiles}>
            <StatTile
              label="Tasks"
              value={tasks.length}
              hint={`in ${plan.sections.length} sections`}
            />
            <StatTile
              label="Done"
              value={done}
              hint={formatPercent(done, tasks.length)}
              valueColor="var(--color-positive)"
            />
            <StatTile
              label="In progress"
              value={count("taken")}
              hint={`${owners.size} ${owners.size === 1 ? "person" : "people"}`}
            />
            <StatTile label="Free" value={count("free")} hint="can be taken" />
            <StatTile
              label="Waiting"
              value={count("waiting")}
              hint="on other tasks"
              valueColor="var(--color-attention)"
            />
          </div>
          <ProgressBar
            value={done}
            max={Math.max(tasks.length, 1)}
            tone="positive"
            aria-label={`${done} of ${tasks.length} tasks done`}
          />
        </div>
      </Box>
      <Box
        title="Tasks"
        isTitleStart
        titleAction={
          <div className={styles.actions}>
            <Tabs
              theme="segmented"
              ariaLabel="Show tasks"
              isWrap
              contents={FILTERS.map(({ label, state }) => ({
                tabName: label,
                count: state ? count(state) : tasks.length,
                onTabClick: () => setFilter(state),
              }))}
            />
            <Button color={ButtonColor.TRANSPARENT} onClick={toggleAll}>
              {isAllCollapsed ? "Expand all" : "Collapse all"}
            </Button>
            <Button color={ButtonColor.ACCENT} onClick={addSection}>
              <SvgPlus size="16" />
              Section
            </Button>
          </div>
        }
      >
        <div className={styles.sections}>
          {sections.map((section) => {
            const all = plan.sections.find((item) => item.id === section.id);
            const sectionDone = section.tasks.filter(
              (task) => task.state === "done"
            ).length;
            return (
              <CollapsibleSection
                key={section.id}
                title={`${section.id} · ${section.title.replaceAll("`", "")}`}
                aside={`${sectionDone} of ${section.tasks.length} done`}
                isOpen={!collapsed.has(section.id)}
                onToggle={(isOpen) => toggleSection(section.id, isOpen)}
              >
                {section.tasks.length > 0 && (
                  <Table
                    layout="rows"
                    mobileHeadField="task"
                    isWithoutMobileSorting
                    initialSortingKey="state"
                    initialSortingOrder="asc"
                    rowClickExcludeKeys={["actions"]}
                    columnStyles={{
                      id: { width: "72px", minWidth: "72px" },
                      task: { width: "1fr", minWidth: "220px" },
                      state: { width: "190px", minWidth: "150px" },
                      size: { width: "72px", minWidth: "72px" },
                      actions: { width: "56px", minWidth: "56px" },
                    }}
                    headers={{
                      id: { content: "#" },
                      task: { content: "Task" },
                      state: { content: "State" },
                      size: { content: "Size" },
                      actions: { content: "", isNotSortable: true },
                    }}
                    onRowClick={(index) => openTask(section.tasks[index].id)}
                    rows={section.tasks.map((task) => ({
                      id: {
                        content: (
                          <span {...trigger} className={styles.id}>
                            {task.id}
                          </span>
                        ),
                        sortingValue: task.id,
                      },
                      task: {
                        content: (
                          <span {...trigger} className={styles.task}>
                            <PlanText text={task.title} />
                          </span>
                        ),
                        sortingValue: task.title,
                      },
                      state: {
                        content: (
                          <span {...trigger}>
                            <PlanStateBadge task={task} />
                          </span>
                        ),
                        sortingValue: STATE_ORDER[task.state],
                      },
                      size: {
                        content: <span {...trigger}>{task.size ?? "—"}</span>,
                      },
                      actions: {
                        content: (
                          <PlanTaskMenu
                            slug={slug}
                            task={task}
                            sectionId={section.id}
                          />
                        ),
                      },
                    }))}
                  />
                )}
                <div className={styles.sectionFooter}>
                  <Button onClick={() => addTask(section.id)}>
                    <SvgPlus size="16" />
                    Task
                  </Button>
                  <Button
                    color={ButtonColor.TRANSPARENT}
                    onClick={() => renameSection(section)}
                  >
                    Rename
                  </Button>
                  {!all?.tasks.length && (
                    <Button
                      color={ButtonColor.TRANSPARENT}
                      onClick={() => deleteSection(section.id)}
                    >
                      Delete section
                    </Button>
                  )}
                </div>
              </CollapsibleSection>
            );
          })}
        </div>
      </Box>
    </>
  );
};
