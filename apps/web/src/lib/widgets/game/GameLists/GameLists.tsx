import { FC } from "react";
import { ICustomList } from "@mooncellar/schemas";
import { Box } from "@/src/lib/shared/ui/Box";
import { ListCard } from "@/src/lib/shared/ui/ListCard";
import { ListCardsGrid } from "@/src/lib/shared/ui/ListCardsGrid";

interface IGameListsProps {
  lists: ICustomList[];
}

export const GameLists: FC<IGameListsProps> = ({ lists }) => {
  if (!lists.length) return null;

  return (
    <Box
      title="Lists that include it"
      isTitleStart
      contentStyle={{ padding: "var(--padding-x4)" }}
    >
      <ListCardsGrid isDense>
        {lists.map((list) => (
          <ListCard
            key={list._id}
            list={list}
            authorLabel={list.isGenerated ? "Collection" : undefined}
          />
        ))}
      </ListCardsGrid>
    </Box>
  );
};
