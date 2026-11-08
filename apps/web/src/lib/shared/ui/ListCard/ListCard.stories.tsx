import type { ICustomList } from "@mooncellar/schemas";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ListCard, ListCardSkeleton, ListMosaic } from "./ListCard";

const list: ICustomList = {
  _id: "6650a1f2c3b4d5e6f7a8b9c0",
  userId: "6650a1f2c3b4d5e6f7a8b9c1",
  name: "Best metroidvanias of the decade",
  slug: "best-metroidvanias-of-the-decade",
  description: "Hollow Knight, Ori and everything else worth backtracking for.",
  isPrivate: false,
  isRanked: true,
  sortBy: "position",
  sortOrder: "asc",
  gamesCount: 18,
  likesCount: 34,
  covers: [
    "/images/cover.png",
    "/images/moon.jpg",
    "/images/moon2.jpg",
    "/images/moon3.jpg",
  ],
  author: { _id: "6650a1f2c3b4d5e6f7a8b9c1", userName: "Kaelen" },
  createdAt: "2026-03-14T10:00:00.000Z",
  updatedAt: "2026-09-28T18:30:00.000Z",
};

const meta = {
  title: "Shared/ListCard",
  component: ListCard,
  args: { list },
  decorators: [
    (Story) => (
      <div style={{ width: 220 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ListCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Tile: Story = {};

export const TileCollection: Story = {
  args: {
    list: {
      ...list,
      name: "Best games of the 2010s",
      gamesCount: 100,
      likesCount: 18,
      isGenerated: true,
      author: { _id: "6650a1f2c3b4d5e6f7a8b9c2", userName: "MoonCellar" },
    },
    authorLabel: "Collection",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 160 }}>
        <Story />
      </div>
    ),
  ],
};

export const TilePrivateNoLikes: Story = {
  args: {
    list: {
      ...list,
      name: "Backlog shame pile",
      isPrivate: true,
      likesCount: 0,
    },
    isWithAuthor: false,
  },
};

export const Row: Story = {
  args: { layout: "row" },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
};

export const RowDescriptionMatch: Story = {
  args: { layout: "row", query: "ori" },
  decorators: Row.decorators,
};

export const EmptyList: Story = {
  args: {
    list: {
      ...list,
      name: "Games to play in 2027",
      covers: [],
      gamesCount: 0,
      likesCount: 0,
    },
  },
};

export const Mosaic: Story = {
  render: () => (
    <div style={{ width: 160 }}>
      <ListMosaic covers={list.covers.slice(0, 3)} sizes="160px" />
    </div>
  ),
};

export const TileSkeleton: Story = {
  render: () => <ListCardSkeleton />,
};

export const RowSkeleton: Story = {
  render: () => <ListCardSkeleton layout="row" />,
};
