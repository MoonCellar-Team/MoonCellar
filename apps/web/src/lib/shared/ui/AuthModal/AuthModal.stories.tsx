import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Box } from "../Box";
import { Button } from "../Button";
import { AuthModal, openAuthModal } from "./AuthModal";
import { asModal } from "@/.storybook/decorators";

const meta = {
  title: "Shared/AuthModal",
  component: AuthModal,
  decorators: [asModal],
} satisfies Meta<typeof AuthModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Inline: Story = {};

export const SignIn: Story = {
  args: { isSignIn: true },
  parameters: {
    docs: {
      description: {
        story:
          "The sign-up and sign-in forms carry the Google, GitHub and Reddit buttons. They are plain links to the API, so a story never sends anyone anywhere.",
      },
    },
  },
};

export const InModal: Story = {
  render: () => <Button onClick={() => openAuthModal()}>Sign in</Button>,
};

export const Page: Story = {
  args: { isPage: true },
  decorators: [
    (Story) => (
      <Box wrapperStyle={{ width: "380px" }}>
        <Story />
      </Box>
    ),
  ],
};

export const CodeStep: Story = {
  args: { initialStep: "verify-email", initialEmail: "alex@example.com" },
};

export const TwoFactorStep: Story = {
  args: {
    isSignIn: true,
    initialStep: "two-factor",
    initialEmail: "alex@example.com",
  },
};

export const TwoFactorTicketStep: Story = {
  args: {
    isPage: true,
    isSignIn: true,
    initialStep: "two-factor",
    initialTwoFactorMethod: "app",
    twoFactorTicket: "ticket",
  },
  decorators: [
    (Story) => (
      <Box wrapperStyle={{ width: "380px" }}>
        <Story />
      </Box>
    ),
  ],
};
