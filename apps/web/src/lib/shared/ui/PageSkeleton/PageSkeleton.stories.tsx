import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PageCrumbsSkeleton } from "./PageCrumbsSkeleton";
import { PageSkeleton } from "./PageSkeleton";

const meta = {
  title: "Shared/PageSkeleton",
  component: PageSkeleton,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof PageSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Crumbs: Story = {
  render: () => <PageCrumbsSkeleton />,
};
