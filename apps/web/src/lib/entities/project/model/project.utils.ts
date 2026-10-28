import { IProject, IProjectBlock, IProjectUpload } from "@mooncellar/schemas";
import { commonUtils } from "@/src/lib/shared/utils/common.utils";

export const PROJECT_BLOCK_TITLES: Record<IProjectBlock, string> = {
  decomp: "Decompilation",
  plan: "Plan",
};

export const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

export const getProjectUpload = (project: IProject, block: IProjectBlock) =>
  project.uploads.find((upload) => upload.block === block);

export const getLastUpload = (project: IProject): IProjectUpload | undefined =>
  [...project.uploads].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  )[0];

export const isStaleUpload = (
  upload: IProjectUpload | undefined,
  now = Date.now()
) => !!upload && now - new Date(upload.updatedAt).getTime() > STALE_UPLOAD_MS;

export const formatPercent = (done: number, total: number) =>
  total ? `${((100 * done) / total).toFixed(1)}%` : "0%";

export const getProjectSummary = (project: IProject) => {
  const progress = project.blocks.flatMap((block) => {
    const upload = getProjectUpload(project, block);
    if (!upload) return [];
    return [
      block === "decomp"
        ? `${formatPercent(upload.done, upload.total)} decompiled`
        : `${upload.done} of ${upload.total} done`,
    ];
  });
  const lastUpload = getLastUpload(project);
  if (!lastUpload) return "Nothing uploaded yet";
  return `${progress.join(" · ")} · ${commonUtils.getHumanDate(lastUpload.updatedAt)}`;
};
