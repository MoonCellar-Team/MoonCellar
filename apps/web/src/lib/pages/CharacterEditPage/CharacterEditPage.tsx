"use client";

import { FC, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import { ISaveCharacterRequest } from "@mooncellar/schemas";
import { useCharacterByIdQuery } from "@/src/lib/entities/character/api";
import { useAuthStore } from "@/src/lib/shared/store/auth.store";
import { Box } from "@/src/lib/shared/ui/Box";
import { Breadcrumbs } from "@/src/lib/shared/ui/Breadcrumbs";
import {
  ADMIN_HREF,
  getAdminHref,
} from "@/src/lib/shared/utils/admin-url.utils";
import { toast } from "@/src/lib/shared/utils/toast.utils";
import { AiCharacterDrafts } from "@/src/lib/widgets/admin/AiCharacterDrafts";
import { CharacterEditor } from "@/src/lib/widgets/admin/CharacterEditor";
import { CharacterEditPageSkeleton } from "./CharacterEditPageSkeleton";
import styles from "./CharacterEditPage.module.scss";

interface ICharacterEditPageProps {
  characterId?: string;
}

export const CharacterEditPage: FC<ICharacterEditPageProps> = ({
  characterId,
}) => {
  const router = useRouter();
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const isAuthChecked = useAuthStore((s) => s.isAuthChecked);
  const isCreate = !characterId;

  const [draft, setDraft] = useState<{
    value: ISaveCharacterRequest;
    version: number;
  }>();

  const { data: character, isLoading } = useCharacterByIdQuery(characterId);

  if (isAuthChecked && !isAdmin) notFound();

  if (!isAdmin) return;

  if (!isCreate && isLoading) return <CharacterEditPageSkeleton />;

  if (!isCreate && !character) notFound();

  return (
    <Box classNameContent={styles.content}>
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Admin", href: ADMIN_HREF },
          { name: "Characters", href: getAdminHref("characters") },
          {
            name: character?.name ?? "New character",
            href: `/admin/characters/${character?._id ?? "new"}`,
          },
        ]}
      />
      {isCreate && (
        <AiCharacterDrafts
          isReplacing={!!draft}
          onApply={(value) => {
            setDraft((current) => ({
              value,
              version: (current?.version ?? 0) + 1,
            }));
            toast.success({
              description:
                "Draft applied. The portrait link is copied to storage on save",
            });
          }}
        />
      )}
      <CharacterEditor
        key={character?._id ?? `new-${draft?.version ?? 0}`}
        character={character ?? undefined}
        draft={isCreate ? draft?.value : undefined}
        onSaved={(saved) => {
          if (isCreate) router.replace(`/admin/characters/${saved._id}`);
        }}
        onClose={() => router.push(getAdminHref("characters"))}
      />
    </Box>
  );
};
