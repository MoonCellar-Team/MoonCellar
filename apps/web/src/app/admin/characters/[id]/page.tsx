import { Suspense } from "react";
import {
  CharacterEditPage,
  CharacterEditPageSkeleton,
} from "@/src/lib/pages/CharacterEditPage";

const AdminCharacterEditPage = async ({ params }: { params: any }) => {
  const { id } = await params;

  return (
    <Suspense fallback={<CharacterEditPageSkeleton />}>
      <CharacterEditPage characterId={id === "new" ? undefined : id} />
    </Suspense>
  );
};

export default AdminCharacterEditPage;
