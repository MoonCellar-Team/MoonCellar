"use client";
import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { notFound, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Controller,
  FieldErrors,
  Path,
  Resolver,
  SubmitHandler,
  useForm,
} from "react-hook-form";
import {
  useAdminGameQuery,
  useGameFiltersQuery,
} from "@/src/lib/entities/game/api/game.queries";
import {
  useCreateGameMutation,
  useFindGameImagesMutation,
  useImportGameImageMutation,
  useDeleteGameMutation,
  useUpdateGameMutation,
  useUploadGameImageMutation,
} from "@/src/lib/entities/game/api/game.mutations";
import { usePlatformsQuery } from "@/src/lib/entities/platform/api/platform.queries";
import {
  hltbApi,
  igdbApi,
  raApi,
  steamAPI,
  vndbApi,
} from "@/src/lib/shared/api";
import { revalidateGamePage } from "@/src/lib/entities/game/api/game.actions";
import { modal } from "@/src/lib/shared/ui/Modal";
import { ConfirmModal } from "@/src/lib/shared/ui/ConfirmModal";
import {
  AddGameRequestSchema,
  IAddGameRequest,
  IGameImageKind,
  IGameResponse,
  IUpdateGameRequest,
  UpdateGameRequestSchema,
} from "@mooncellar/schemas";
import { useAuthStore } from "@/src/lib/shared/store/auth.store";
import { Box } from "@/src/lib/shared/ui/Box";
import { Breadcrumbs } from "@/src/lib/shared/ui/Breadcrumbs";
import {
  ADMIN_HREF,
  getAdminHref,
} from "@/src/lib/shared/utils/admin-url.utils";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { Dropdown } from "@/src/lib/shared/ui/Dropdown";
import { SectionTitle } from "@/src/lib/shared/ui/SectionTitle";
import { useMinimumLoading } from "@/src/lib/shared/hooks/useMinimumLoading";
import { toast } from "@/src/lib/shared/utils/toast.utils";
import {
  CollapsibleSection,
  DateField,
  EnumField,
  EnumListField,
  IImagePickerOption,
  IObjectFieldDescriptor,
  ImagePickerField,
  NumberField,
  NumberListField,
  ObjectListField,
  StringListField,
  TextField,
  TextareaField,
  ToggleField,
  UploadButton,
} from "@/src/lib/shared/ui/Fields";
import { AiGameDrafts } from "@/src/lib/widgets/admin/AiGameDrafts";
import { ImageFinder } from "@/src/lib/shared/ui/ImageFinder";
import {
  GAME_SECTIONS,
  IFieldDescriptor,
  IOptionsKey,
} from "@/src/lib/features/game/model/game-edit-sections";
import { GameEditPageSkeleton } from "./GameEditPageSkeleton";
import styles from "./GameEditPage.module.scss";
import { confirmPossibleDuplicates } from "@/src/lib/entities/game/ui/PossibleDuplicates";
import { getPossibleDuplicates } from "@/src/lib/shared/utils/possible-duplicates.utils";

type IGameFormValues = IUpdateGameRequest;
type IFormPath = Path<IGameFormValues>;

const FIELD_LABELS: Record<string, string> = GAME_SECTIONS.reduce(
  (acc, section) => {
    section.fields.forEach((field) => {
      acc[field.path] = field.label;
    });
    return acc;
  },
  {} as Record<string, string>
);

const OBJECT_LIST_FIELDS: Record<string, IObjectFieldDescriptor[]> =
  GAME_SECTIONS.reduce(
    (acc, section) => {
      section.fields.forEach((field) => {
        if (field.kind === "objectList" && field.fields) {
          acc[field.path] = field.fields;
        }
      });
      return acc;
    },
    {} as Record<string, IObjectFieldDescriptor[]>
  );

const IMAGE_FINDER_LABELS: Record<IGameImageKind, string> = {
  cover: "Find cover",
  screenshots: "Find screenshots",
  artworks: "Find artworks",
};

const CREATE_DEFAULTS: Partial<IGameFormValues> = {
  cover: null,
  screenshots: [],
  artworks: [],
  platformIds: [],
};

const isBlankObjectListRow = (
  row: Record<string, unknown>,
  fields: IObjectFieldDescriptor[]
): boolean =>
  fields.every((field) => {
    if (field.kind === "boolean") return true;

    const value = row[field.key];

    return value === undefined || value === "";
  });

const TOP_LEVEL_PATHS = [
  ...new Set(
    GAME_SECTIONS.flatMap((section) =>
      section.fields.map((field) => field.path.split(".")[0])
    )
  ),
];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const pruneRow = (row: unknown): unknown =>
  isPlainObject(row)
    ? Object.fromEntries(
        Object.entries(row).filter(
          ([, value]) => value !== null && value !== undefined
        )
      )
    : row;

const pruneEmpty = (
  value: Record<string, unknown>,
  isNested = false
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value).flatMap(([key, nested]) => {
      if (nested === undefined) return [];
      if (isNested && nested === null) return [];
      if (Array.isArray(nested)) return [[key, nested.map(pruneRow)]];
      if (!isPlainObject(nested)) return [[key, nested]];

      const pruned = pruneEmpty(nested, true);

      return Object.keys(pruned).length ? [[key, pruned]] : [];
    })
  );

const toFormValues = (game: IGameResponse): IGameFormValues => {
  const { characters: _characters, ...rest } = game;

  return pruneEmpty(rest as Record<string, unknown>) as IGameFormValues;
};

const findErrorMessage = (
  node: unknown,
  visited = new WeakSet<object>()
): string | undefined => {
  if (!node || typeof node !== "object") return;
  if (visited.has(node)) return;

  visited.add(node);

  const record = node as Record<string, unknown>;

  if (typeof record.message === "string") return record.message;

  for (const [key, value] of Object.entries(record)) {
    if (key === "ref") continue;

    const message = findErrorMessage(value, visited);
    if (message) return message;
  }
};

const getErrorMessage = (
  errors: FieldErrors<IGameFormValues>,
  path: string
): string | undefined => {
  let node: unknown = errors;

  for (const part of path.split(".")) {
    const directMessage = (node as Record<string, unknown> | undefined)
      ?.message;
    if (typeof directMessage === "string") return directMessage;

    node = (node as Record<string, unknown> | undefined)?.[part];
    if (!node) return;
  }

  return findErrorMessage(node);
};

interface IGameEditPageProps {
  gameId?: string;
}

export const GameEditPage: FC<IGameEditPageProps> = ({ gameId }) => {
  const router = useRouter();
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const isAuthChecked = useAuthStore((s) => s.isAuthChecked);
  const isCreate = !gameId;
  const [original, setOriginal] = useState<Record<string, unknown>>({});
  const [invalidField, setInvalidField] = useState<{
    path: string;
    submission: number;
  } | null>(null);
  const [parsingSource, setParsingSource] = useState<
    "igdb" | "vndb" | "hltb" | "ra" | "steam" | null
  >(null);

  const {
    data: game,
    isPending: isGamePending,
    isError: isGameError,
    refetch: refetchGame,
  } = useAdminGameQuery(gameId);

  const { data: filters, isPending: isFiltersPending } = useGameFiltersQuery();
  const { data: platforms = [], isPending: isPlatformsPending } =
    usePlatformsQuery();

  const { mutate: createGame, isPending: isCreating } = useCreateGameMutation();
  const { mutate: updateGame, isPending: isUpdating } = useUpdateGameMutation();
  const { mutateAsync: uploadGameImage, isPending: isUploading } =
    useUploadGameImageMutation();

  const isPageLoading = useMinimumLoading(
    isFiltersPending || isPlatformsPending || Boolean(gameId && isGamePending)
  );

  const resolver = useMemo<Resolver<IGameFormValues>>(() => {
    const zod = zodResolver(
      isCreate ? AddGameRequestSchema : UpdateGameRequestSchema
    ) as unknown as Resolver<IGameFormValues>;

    return (values, context, options) =>
      zod(
        pruneEmpty(values as Record<string, unknown>) as IGameFormValues,
        context,
        options
      );
  }, [isCreate]);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState,
  } = useForm<IGameFormValues>({
    resolver,
    mode: "onBlur",
    defaultValues: isCreate ? CREATE_DEFAULTS : {},
  });

  const { errors, isSubmitting } = formState;
  const hltbId = watch("hltb.hltbId");
  const vnIdValue = (watch("vndb.vnId") as string | undefined)?.trim();
  const raEntries = watch("retroachievements") as
    { gameId?: number | string }[] | undefined;
  const [imagePicks, setImagePicks] = useState<
    Record<IGameImageKind, string[]>
  >({ cover: [], screenshots: [], artworks: [] });
  const { mutateAsync: findImages } = useFindGameImagesMutation();
  const { mutateAsync: importImage } = useImportGameImageMutation();
  const { mutateAsync: deleteGame } = useDeleteGameMutation();
  const gameName = watch("name") as string | undefined;
  const externalPages = watch("externalPages") as
    { name?: string; uid?: string }[] | undefined;
  const steamAppId = externalPages?.find(
    (page) => page.name === "Steam" && /^\d+$/.test(page.uid ?? "")
  )?.uid;
  const artworks = watch("artworks");
  const screenshots = watch("screenshots");

  const pictureOptions = useMemo<IImagePickerOption[]>(
    () => [
      ...(artworks ?? []).map((url, index) => ({
        url,
        caption: `Artwork ${index + 1}`,
      })),
      ...(screenshots ?? []).map((url, index) => ({
        url,
        caption: `Screenshot ${index + 1}`,
      })),
    ],
    [artworks, screenshots]
  );

  const hydratedGameIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!gameId || !game) return;
    if (hydratedGameIdRef.current === gameId) return;
    hydratedGameIdRef.current = gameId;
    setOriginal(game as unknown as Record<string, unknown>);
    reset(toFormValues(game));
  }, [gameId, game, reset]);

  useEffect(() => {
    if (gameId) return;
    hydratedGameIdRef.current = undefined;
    setOriginal({});
    reset(CREATE_DEFAULTS);
  }, [gameId, reset]);

  useEffect(() => {
    if (!gameId || !isGameError) return;
    router.push(getAdminHref("games"));
  }, [gameId, isGameError, router]);

  const optionsFor = useCallback(
    (key?: IOptionsKey): string[] =>
      key && filters ? (filters[key] ?? []) : [],
    [filters]
  );

  const resolvedObjectFields = useMemo(() => {
    const map: Record<string, IObjectFieldDescriptor[]> = {};

    GAME_SECTIONS.forEach((section) =>
      section.fields.forEach((field) => {
        if (field.kind !== "objectList" || !field.fields) return;

        map[field.path] = field.fields.map((column) =>
          column.optionsKey
            ? {
                ...column,
                options: optionsFor(column.optionsKey as IOptionsKey),
              }
            : column
        );
      })
    );

    return map;
  }, [optionsFor]);

  useEffect(() => {
    if (!invalidField) return;

    const frame = requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(
        `[data-game-field="${CSS.escape(invalidField.path)}"]`
      );

      if (!element) return;

      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element
        .querySelector<HTMLElement>(
          "input, textarea, button, [tabindex]:not([tabindex='-1'])"
        )
        ?.focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [invalidField]);

  const platformNames = useMemo(
    () => platforms.map((platform) => platform.name),
    [platforms]
  );

  const applyImagePicks = async (data: IGameFormValues) => {
    const store = (url: string, type: "cover" | "screenshot" | "artwork") =>
      isCreate || !gameId
        ? Promise.resolve(url)
        : importImage({ gameId, url, type });
    const values = data as Record<string, unknown>;
    const [cover, screenshots, artworks] = await Promise.all([
      Promise.all(imagePicks.cover.map((url) => store(url, "cover"))),
      Promise.all(
        imagePicks.screenshots.map((url) => store(url, "screenshot"))
      ),
      Promise.all(imagePicks.artworks.map((url) => store(url, "artwork"))),
    ]);

    return {
      ...values,
      ...(cover[0] && { cover: cover[0] }),
      ...(screenshots.length && {
        screenshots: [
          ...((values.screenshots as string[]) ?? []),
          ...screenshots,
        ],
      }),
      ...(artworks.length && {
        artworks: [...((values.artworks as string[]) ?? []), ...artworks],
      }),
    } as IGameFormValues;
  };

  const onValid: SubmitHandler<IGameFormValues> = async (formData) => {
    let data: IGameFormValues;

    try {
      data = await applyImagePicks(formData);
    } catch {
      return;
    }

    if (isCreate) {
      const create = (force?: boolean) =>
        createGame(
          { data: data as IAddGameRequest, force },
          {
            onSuccess: (game) => {
              toast.success({ description: "Game created" });
              router.push(`/admin/games/${game._id}`);
            },
            onError: (error) => {
              const duplicates = getPossibleDuplicates(error);

              if (duplicates) {
                confirmPossibleDuplicates(duplicates, () => create(true));
              }
            },
          }
        );

      create();
      return;
    }

    const sanitized: Record<string, unknown> = {
      ...(data as Record<string, unknown>),
    };
    Object.entries(OBJECT_LIST_FIELDS).forEach(([path, fields]) => {
      const rows = sanitized[path];
      if (!Array.isArray(rows)) return;

      sanitized[path] = rows.filter(
        (row) => !isBlankObjectListRow(row as Record<string, unknown>, fields)
      );
    });

    const patch: Record<string, unknown> = {};
    new Set([...TOP_LEVEL_PATHS, ...Object.keys(sanitized)]).forEach((key) => {
      const value = sanitized[key];

      if (JSON.stringify(value) === JSON.stringify(original[key])) return;
      if ((value ?? null) === null && (original[key] ?? null) === null) return;
      if (value === undefined && isPlainObject(original[key])) return;

      patch[key] = value === undefined ? null : value;
    });

    if (!Object.keys(patch).length) {
      toast.success({ description: "Nothing to save" });
      return;
    }

    if (!gameId) return;

    updateGame(
      { gameId, patch: patch as IUpdateGameRequest },
      {
        onSuccess: (game) => {
          toast.success({ description: "Game updated" });
          revalidateGamePage(original.slug as string, game.slug).catch(
            () => undefined
          );
          setOriginal((current) => ({
            ...(game as unknown as Record<string, unknown>),
            characters: current.characters,
          }));
          reset(toFormValues(game));
          setImagePicks({ cover: [], screenshots: [], artworks: [] });
        },
      }
    );
  };

  const onInvalid = (formErrors: FieldErrors<IGameFormValues>) => {
    const labels: string[] = [];
    const invalidPath = Object.keys(FIELD_LABELS).find((path) =>
      getErrorMessage(formErrors, path)
    );

    Object.keys(FIELD_LABELS).forEach((path) => {
      if (!getErrorMessage(formErrors, path)) return;
      const label = FIELD_LABELS[path];
      if (!labels.includes(label)) labels.push(label);
    });

    toast.error({
      description: `Required fields are missing or invalid: ${labels.join(", ") || "check the form"}`,
    });

    if (invalidPath) {
      setInvalidField((current) => ({
        path: invalidPath,
        submission: (current?.submission ?? 0) + 1,
      }));
    }
  };

  const originalIgdbId = (original.igdb as IGameResponse["igdb"])?.gameId;
  const originalVnId = (original.vndb as IGameResponse["vndb"])?.vnId;
  const originalRaIds = new Set(
    (
      (original.retroachievements as IGameResponse["retroachievements"]) ?? []
    ).map(({ gameId }) => String(gameId))
  );
  const raIds = (raEntries ?? [])
    .map(({ gameId }) => String(gameId ?? "").trim())
    .filter(Boolean);
  const newRaIds = raIds.filter((id) => !originalRaIds.has(id));
  const isDirty = formState.isDirty;

  const reloadGame = async () => {
    const { data } = await refetchGame();

    if (!data) return;

    setOriginal(data as unknown as Record<string, unknown>);
    reset(toFormValues(data));
  };

  const runParse = async (
    source: "igdb" | "vndb" | "hltb" | "ra" | "steam",
    parse: () => Promise<{ slug?: string; isFailed?: boolean; message: string }>
  ) => {
    if (!gameId || parsingSource) return;

    setParsingSource(source);

    try {
      const { slug, isFailed, message } = await parse();

      if (isFailed) {
        toast.error({ description: message });
      } else {
        toast.success({ description: message });
      }

      await revalidateGamePage(original.slug as string, slug);
      await reloadGame();
    } catch {
      toast.error({
        description: `Failed to parse from ${source.toUpperCase()}`,
      });
    } finally {
      setParsingSource(null);
    }
  };

  const handleParseIgdb = () =>
    runParse("igdb", async () => {
      const { data } = await igdbApi.parseGame(originalIgdbId!);

      return { slug: data?.slug, message: "Parsed from IGDB" };
    });

  const handleFullParseIgdb = () =>
    runParse("igdb", async () => {
      const { data } = await igdbApi.parseGame(originalIgdbId!, true, true);

      return { slug: data?.slug, message: "Fully reparsed from IGDB" };
    });

  const handleParseVndb = () =>
    runParse("vndb", async () => {
      const { data } = await vndbApi.parseGame(
        gameId!,
        vnIdValue && vnIdValue !== originalVnId ? vnIdValue : undefined
      );

      return {
        slug: data.slug,
        isFailed: data.status === "failed",
        message: data.message,
      };
    });

  const handleParseHltb = () =>
    runParse("hltb", async () => {
      const { data } = await hltbApi.parseGame({
        gameId: gameId!,
        hltbId: hltbId?.trim() || undefined,
      });

      return {
        slug: data.slug,
        isFailed: data.status === "not_found",
        message: data.message,
      };
    });

  const handleParseRa = () =>
    runParse("ra", async () => {
      if (!newRaIds.length) {
        const { data } = await raApi.parseGame({ gameId: gameId! });

        return { slug: data.slug, message: data.message };
      }

      let slug: string | undefined;

      for (const raId of newRaIds) {
        const { data } = await raApi.parseGame({ gameId: gameId!, raId });
        slug = data.slug;
      }

      return {
        slug,
        message: `Linked RetroAchievements ${newRaIds.join(", ")}`,
      };
    });

  const originalSteamAppId = (
    original.externalPages as IGameResponse["externalPages"]
  )?.find((page) => page.name === "Steam" && /^\d+$/.test(page.uid ?? ""))?.uid;

  const handleParseSteamAchievements = () =>
    runParse("steam", async () => {
      const { data } = await steamAPI.parseAchievements(gameId!);

      return {
        message: data.total
          ? `${data.total} achievements on Steam`
          : "The Steam app has no achievements",
      };
    });

  const handleApplyDraft = (draft: Partial<IAddGameRequest>) => {
    reset({
      ...CREATE_DEFAULTS,
      ...(pruneEmpty(draft as Record<string, unknown>) as IGameFormValues),
    });
    toast.success({
      description: "Draft applied. External images are stored on Create",
    });
  };

  const handleUpload = async (
    path: string,
    uploadType: "cover" | "screenshot" | "artwork",
    file: File
  ) => {
    if (!gameId) return;

    const url = await uploadGameImage({
      gameId,
      type: uploadType,
      file,
    });

    addImageUrl(path, uploadType, url);
  };

  const addImageUrl = (
    path: string,
    uploadType: "cover" | "screenshot" | "artwork",
    url: string
  ) => {
    const formPath = path as IFormPath;

    if (uploadType === "cover") {
      setValue(formPath, url, { shouldDirty: true });
      return;
    }

    const current = (getValues(formPath) as string[] | undefined) || [];
    setValue(formPath, [...current, url], { shouldDirty: true });
  };

  const handleDelete = () => {
    if (!gameId) return;

    const modalId = `delete-game-${gameId}`;
    const name = original.name as string;
    const slug = original.slug as string;

    modal.open(
      <ConfirmModal
        title="Delete game"
        message={
          <>
            Delete <strong>{name}</strong>?
          </>
        }
        warning="This permanently deletes the game."
        onConfirm={() =>
          deleteGame(gameId).then(async () => {
            modal.close(modalId);
            toast.success({ description: "Game deleted" });
            await revalidateGamePage(slug).catch(() => undefined);
            router.push(getAdminHref("games"));
          })
        }
        onCancel={() => modal.close(modalId)}
      />,
      { id: modalId }
    );
  };

  const renderImageFinder = (kind: IGameImageKind) => (
    <ImageFinder
      label={IMAGE_FINDER_LABELS[kind]}
      isPortrait={kind === "cover"}
      isMultiple={kind !== "cover"}
      selected={imagePicks[kind]}
      onChange={(selected) =>
        setImagePicks((current) => ({ ...current, [kind]: selected }))
      }
      emptyText="Nothing found. Check the game name or add its Steam page."
      defaultQuery={gameName ?? ""}
      onSearch={(name, page) =>
        findImages({
          name,
          kind,
          page,
          ...(steamAppId && { steamAppId }),
        })
      }
    />
  );

  const renderField = (
    field: IFieldDescriptor,
    isLabelHidden: boolean = false
  ) => {
    const formPath = field.path as IFormPath;
    const error = getErrorMessage(errors, field.path);

    switch (field.kind) {
      case "text":
        return (
          <Controller
            key={field.path}
            control={control}
            name={formPath}
            render={({ field: rhf }) => (
              <TextField
                label={field.label}
                value={rhf.value as string}
                error={error}
                isLabelHidden={isLabelHidden}
                onChange={rhf.onChange}
              />
            )}
          />
        );
      case "number":
        return (
          <Controller
            key={field.path}
            control={control}
            name={formPath}
            render={({ field: rhf }) => (
              <NumberField
                label={field.label}
                value={rhf.value as number | null}
                error={error}
                onChange={rhf.onChange}
              />
            )}
          />
        );
      case "date":
        return (
          <Controller
            key={field.path}
            control={control}
            name={formPath}
            render={({ field: rhf }) => (
              <DateField
                label={field.label}
                value={rhf.value as number | null | undefined}
                error={error}
                isLabelHidden={isLabelHidden}
                onChange={rhf.onChange}
              />
            )}
          />
        );
      case "textarea":
        return (
          <Controller
            key={field.path}
            control={control}
            name={formPath}
            render={({ field: rhf }) => (
              <TextareaField
                label={field.label}
                value={rhf.value as string}
                onChange={rhf.onChange}
              />
            )}
          />
        );
      case "toggle":
        return (
          <Controller
            key={field.path}
            control={control}
            name={formPath}
            render={({ field: rhf }) => (
              <ToggleField
                label={field.label}
                value={rhf.value as boolean}
                onChange={rhf.onChange}
              />
            )}
          />
        );
      case "stringList":
        return (
          <Controller
            key={field.path}
            control={control}
            name={formPath}
            render={({ field: rhf }) => (
              <StringListField
                label={field.label}
                value={rhf.value as string[]}
                onChange={rhf.onChange}
              />
            )}
          />
        );
      case "numberList":
        return (
          <Controller
            key={field.path}
            control={control}
            name={formPath}
            render={({ field: rhf }) => (
              <NumberListField
                label={field.label}
                value={rhf.value as number[]}
                onChange={rhf.onChange}
              />
            )}
          />
        );
      case "enum":
        return (
          <Controller
            key={field.path}
            control={control}
            name={formPath}
            render={({ field: rhf }) => (
              <EnumField
                label={field.label}
                value={rhf.value as string}
                options={optionsFor(field.optionsKey)}
                error={error}
                onChange={rhf.onChange}
              />
            )}
          />
        );
      case "enumList":
        return (
          <Controller
            key={field.path}
            control={control}
            name={formPath}
            render={({ field: rhf }) => (
              <EnumListField
                label={field.label}
                value={rhf.value as string[]}
                options={optionsFor(field.optionsKey)}
                onChange={rhf.onChange}
              />
            )}
          />
        );
      case "objectList":
        return (
          <Controller
            key={field.path}
            control={control}
            name={formPath}
            render={({ field: rhf }) => (
              <div>
                <ObjectListField
                  label={field.label}
                  value={rhf.value as Record<string, unknown>[]}
                  fields={
                    resolvedObjectFields[field.path] || field.fields || []
                  }
                  isLabelHidden={isLabelHidden}
                  onChange={rhf.onChange}
                />
                {!!error && <span className={styles.fieldError}>{error}</span>}
              </div>
            )}
          />
        );
      case "platforms":
        return (
          <Controller
            key={field.path}
            control={control}
            name={formPath}
            render={({ field: rhf }) => (
              <div>
                <Dropdown
                  list={platformNames}
                  title={isLabelHidden ? undefined : field.label}
                  placeholder="Select platforms"
                  overwriteValue={
                    (rhf.value as string[])?.length
                      ? `Selected ${(rhf.value as string[]).length}`
                      : undefined
                  }
                  isMulti
                  isWithSearch
                  isWithReset
                  isThroughPortal
                  initialMultiValue={((rhf.value as string[]) || [])
                    .map((id) => platforms.findIndex((p) => p._id === id))
                    .filter((index) => index >= 0)}
                  getIndexes={(indexes) =>
                    rhf.onChange(
                      indexes
                        .map((index) => platforms[index]?._id)
                        .filter(Boolean)
                    )
                  }
                />
                {!!error && <span className={styles.fieldError}>{error}</span>}
              </div>
            )}
          />
        );
      case "coverUpload":
        return (
          <Controller
            key={field.path}
            control={control}
            name={formPath}
            render={({ field: rhf }) => (
              <div>
                <TextField
                  label={field.label}
                  value={rhf.value as string}
                  error={error}
                  readOnly
                  isLabelHidden={isLabelHidden}
                  onChange={rhf.onChange}
                />
                {!!rhf.value && (
                  <Image
                    className={styles.preview}
                    src={rhf.value as string}
                    alt="Game cover"
                    width={160}
                    height={224}
                    unoptimized={isCreate}
                  />
                )}
                {isCreate ? (
                  <span className={styles.uploadHint}>
                    Save the game first to upload images
                  </span>
                ) : (
                  <UploadButton
                    onFile={(file) =>
                      handleUpload(field.path, "cover", file).catch(
                        () => undefined
                      )
                    }
                  />
                )}
                {renderImageFinder("cover")}
              </div>
            )}
          />
        );
      case "imageList":
        return (
          <Controller
            key={field.path}
            control={control}
            name={formPath}
            render={({ field: rhf }) => (
              <div>
                <StringListField
                  label={field.label}
                  value={rhf.value as string[]}
                  onChange={rhf.onChange}
                  isAddDisabled
                  action={
                    isCreate ? (
                      <span className={styles.uploadHint}>
                        Save the game first to upload
                      </span>
                    ) : (
                      <UploadButton
                        onFile={(file) =>
                          field.uploadType &&
                          handleUpload(
                            field.path,
                            field.uploadType,
                            file
                          ).catch(() => undefined)
                        }
                      />
                    )
                  }
                />
                {renderImageFinder(
                  field.uploadType === "screenshot" ? "screenshots" : "artworks"
                )}
              </div>
            )}
          />
        );
      case "imagePicker":
        return (
          <Controller
            key={field.path}
            control={control}
            name={formPath}
            render={({ field: rhf }) => (
              <ImagePickerField
                label={field.label}
                value={rhf.value as string | null | undefined}
                options={pictureOptions}
                autoCaption={field.autoCaption ?? "Automatic"}
                isUnoptimized={isCreate}
                onChange={rhf.onChange}
              />
            )}
          />
        );
      default:
        return null;
    }
  };

  if (isAuthChecked && !isAdmin) notFound();

  if (!isAdmin) return;

  if (isPageLoading || !filters) return <GameEditPageSkeleton />;

  return (
    <Box classNameContent={styles.content}>
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Admin", href: ADMIN_HREF },
          { name: "Games", href: getAdminHref("games") },
          {
            name: isCreate ? "Create game" : (original.name as string),
            href: isCreate
              ? "/admin/games/new"
              : `/admin/games/${gameId as string}`,
          },
        ]}
      />
      <div className={styles.header}>
        <SectionTitle as="h1">
          {isCreate ? "Create game" : `Edit: ${original.name as string}`}
        </SectionTitle>
        <div className={styles.actions}>
          {!isCreate && (
            <Button
              color={ButtonColor.DEFAULT}
              href={`/games/${original.slug as string}`}
            >
              View game
            </Button>
          )}
          {!isCreate && (
            <Button
              color={ButtonColor.DEFAULT}
              disabled={!!parsingSource || !originalIgdbId || !!originalVnId}
              tooltip={
                originalVnId
                  ? "Linked to VNDB: the IGDB sync does not touch this game"
                  : !originalIgdbId
                    ? "Save an IGDB game id first"
                    : isDirty
                      ? "Unsaved changes will be replaced by the parsed data"
                      : undefined
              }
              onClick={handleParseIgdb}
            >
              {parsingSource === "igdb" ? "Parsing…" : "Parse from IGDB"}
            </Button>
          )}
          {!isCreate && (
            <Button
              color={ButtonColor.DEFAULT}
              disabled={!!parsingSource || !originalIgdbId || !!originalVnId}
              tooltip={
                originalVnId
                  ? "Linked to VNDB: the IGDB sync does not touch this game"
                  : !originalIgdbId
                    ? "Save an IGDB game id first"
                    : "Replaces every IGDB field and re-downloads all images"
              }
              onClick={handleFullParseIgdb}
            >
              {parsingSource === "igdb" ? "Parsing…" : "Full reparse from IGDB"}
            </Button>
          )}
          {!isCreate && (
            <Button
              color={ButtonColor.DEFAULT}
              disabled={!!parsingSource || !vnIdValue}
              tooltip={
                !vnIdValue
                  ? "Enter a VNDB id first"
                  : isDirty
                    ? "Unsaved changes will be replaced by the parsed data"
                    : undefined
              }
              onClick={handleParseVndb}
            >
              {parsingSource === "vndb"
                ? "Parsing…"
                : vnIdValue && vnIdValue !== originalVnId
                  ? "Parse VNDB by id"
                  : "Parse from VNDB"}
            </Button>
          )}
          {!isCreate && (
            <Button
              color={ButtonColor.DEFAULT}
              disabled={!!parsingSource || !raIds.length}
              tooltip={
                !raIds.length
                  ? "Add a RetroAchievements id first"
                  : isDirty
                    ? "Unsaved changes will be replaced by the parsed data"
                    : undefined
              }
              onClick={handleParseRa}
            >
              {parsingSource === "ra"
                ? "Parsing…"
                : newRaIds.length
                  ? "Link RetroAchievements by id"
                  : "Refresh RetroAchievements"}
            </Button>
          )}
          {!isCreate && (
            <Button
              color={ButtonColor.DEFAULT}
              disabled={!!parsingSource || !originalSteamAppId}
              tooltip={
                !originalSteamAppId
                  ? "Save a Steam external page first"
                  : steamAppId !== originalSteamAppId
                    ? "Reads the saved Steam app id; save the new one first"
                    : undefined
              }
              onClick={handleParseSteamAchievements}
            >
              {parsingSource === "steam"
                ? "Parsing…"
                : "Parse Steam achievements"}
            </Button>
          )}
          {!isCreate && (
            <Button
              color={ButtonColor.DEFAULT}
              disabled={!!parsingSource}
              tooltip={
                isDirty
                  ? "Unsaved changes will be replaced by the parsed data"
                  : undefined
              }
              onClick={handleParseHltb}
            >
              {parsingSource === "hltb"
                ? "Parsing…"
                : hltbId?.trim()
                  ? "Parse HLTB by id"
                  : "Parse from HLTB"}
            </Button>
          )}
          {!isCreate && (
            <Button color={ButtonColor.RED} onClick={handleDelete}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {isCreate && (
        <AiGameDrafts isReplacing={isDirty} onApply={handleApplyDraft} />
      )}

      <form className={styles.form} onSubmit={handleSubmit(onValid, onInvalid)}>
        {!isCreate && (
          <div className={styles.readonly}>
            <span>id: {original._id as string}</span>
            <span>created: {original.createdAt as string}</span>
            <span>updated: {original.updatedAt as string}</span>
            <span>averageRating: {String(original.averageRating ?? "—")}</span>
            <span>isCustom: {String(original.isCustom ?? false)}</span>
            <span>ratingsCount: {String(original.ratingsCount ?? "—")}</span>
            <span>
              characters:{" "}
              {(original.characters as unknown[] | undefined)?.length ?? 0}
            </span>
            <span>
              source:{" "}
              {originalVnId ? "VNDB" : originalIgdbId ? "IGDB" : "manual"}
            </span>
          </div>
        )}

        <div>
          {GAME_SECTIONS.map((section) => (
            <CollapsibleSection
              key={section.title}
              title={section.title}
              note={section.note}
              isDefaultOpen={section.isDefaultOpen}
              hasError={section.fields.some(
                (field) => !!getErrorMessage(errors, field.path)
              )}
            >
              {section.fields.map((field) => {
                const isLabelHidden =
                  section.fields.length === 1 && field.label === section.title;

                return (
                  <div key={field.path} data-game-field={field.path}>
                    {renderField(field, isLabelHidden)}
                  </div>
                );
              })}
            </CollapsibleSection>
          ))}
        </div>

        <div className={styles.footer}>
          <Button
            type="submit"
            color={ButtonColor.GREEN}
            disabled={isSubmitting || isCreating || isUpdating || isUploading}
          >
            {isCreate ? "Create" : "Save"}
          </Button>
        </div>
      </form>
    </Box>
  );
};
