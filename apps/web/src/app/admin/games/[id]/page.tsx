import {
  GameEditPage,
  GameEditPageSkeleton,
} from "@/src/lib/pages/GameEditPage";
import { Suspense } from "react";

const AdminGameEditPage = async ({ params }: { params: any }) => {
  const { id } = await params;

  return (
    <Suspense fallback={<GameEditPageSkeleton />}>
      <GameEditPage gameId={id === "new" ? undefined : id} />
    </Suspense>
  );
};

export default AdminGameEditPage;
