import { FC, useState } from "react";
import {
  CreateProjectRequestSchema,
  IProject,
  IProjectBlock,
  PROJECT_BLOCKS,
} from "@mooncellar/schemas";
import { PROJECT_BLOCK_TITLES } from "@/src/lib/entities/project/model";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { EnumField, TextField, ToggleField } from "@/src/lib/shared/ui/Fields";
import { toSlug } from "@/src/lib/shared/utils/slug.utils";
import styles from "./ProjectsManager.module.scss";

export interface IProjectFormValues {
  name: string;
  slug: string;
  blocks: IProjectBlock[];
  defaultBlock: IProjectBlock;
}

interface IProjectFormProps {
  project?: IProject;
  /** Starting values of a new project; a given slug is fixed (a connect command waits for it). */
  defaults?: Partial<IProjectFormValues>;
  isPending: boolean;
  submitText: string;
  onSubmit: (values: IProjectFormValues) => void;
  onCancel?: () => void;
}

export const ProjectForm: FC<IProjectFormProps> = ({
  project,
  defaults,
  isPending,
  submitText,
  onSubmit,
  onCancel,
}) => {
  const isSlugLocked = !!project || !!defaults?.slug;
  const [name, setName] = useState(project?.name ?? defaults?.name ?? "");
  const [slug, setSlug] = useState(
    project?.slug ?? defaults?.slug ?? toSlug(defaults?.name ?? "")
  );
  const [isSlugEdited, setIsSlugEdited] = useState(isSlugLocked);
  const [blocks, setBlocks] = useState<IProjectBlock[]>(
    project?.blocks ?? defaults?.blocks ?? ["plan"]
  );
  const [defaultBlock, setDefaultBlock] = useState<IProjectBlock>(
    project?.defaultBlock ?? defaults?.defaultBlock ?? blocks[0]
  );
  const parsed = CreateProjectRequestSchema.safeParse({
    name,
    slug,
    blocks,
    defaultBlock,
  });
  const slugError =
    slug && !parsed.success
      ? parsed.error.issues.find((issue) => issue.path[0] === "slug")?.message
      : undefined;

  const changeName = (value: string) => {
    setName(value);
    if (!isSlugEdited) setSlug(toSlug(value));
  };

  const toggleBlock = (block: IProjectBlock, isOn: boolean) => {
    const next = isOn
      ? [...blocks, block]
      : blocks.filter((value) => value !== block);
    setBlocks(next);
    if (!next.includes(defaultBlock)) setDefaultBlock(next[0] ?? "plan");
  };

  return (
    <div className={styles.form}>
      <div className={styles.form__fields}>
        <TextField label="Name" value={name} onChange={changeName} />
        <TextField
          label="Address"
          value={slug}
          disabled={isSlugLocked}
          error={slugError}
          onChange={(value) => {
            setIsSlugEdited(true);
            setSlug(value);
          }}
        />
      </div>
      <div className={styles.form__blocks}>
        {PROJECT_BLOCKS.map((block) => (
          <ToggleField
            key={block}
            label={PROJECT_BLOCK_TITLES[block]}
            labelPosition="end"
            value={blocks.includes(block)}
            onChange={(isOn) => toggleBlock(block, isOn)}
          />
        ))}
      </div>
      <EnumField
        label="Default page"
        value={PROJECT_BLOCK_TITLES[defaultBlock]}
        options={blocks.map((block) => PROJECT_BLOCK_TITLES[block])}
        onChange={(value) => {
          const selected = PROJECT_BLOCKS.find(
            (block) => PROJECT_BLOCK_TITLES[block] === value
          );
          if (selected) setDefaultBlock(selected);
        }}
      />
      {project && (
        <p className={styles.hint}>
          Turning a block off deletes what the project uploaded for it.
        </p>
      )}
      <div className={styles.form__actions}>
        {onCancel && (
          <Button color={ButtonColor.TRANSPARENT} onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          color={ButtonColor.ACCENT}
          disabled={!parsed.success || isPending}
          isLoading={isPending}
          onClick={() =>
            parsed.success &&
            onSubmit({
              ...parsed.data,
              defaultBlock: parsed.data.defaultBlock ?? defaultBlock,
            })
          }
        >
          {submitText}
        </Button>
      </div>
    </div>
  );
};
