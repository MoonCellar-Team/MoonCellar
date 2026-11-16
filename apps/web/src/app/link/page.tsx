import { Metadata } from "next";
import { Suspense } from "react";
import {
  GameLinkPage,
  GameLinkPageSkeleton,
} from "@/src/lib/pages/GameLinkPage";

export const metadata: Metadata = {
  title: "Link a game",
  description: "Sign a game in with your MoonCellar account",
  robots: { index: false, follow: false },
};

const LinkRoute = () => (
  <Suspense fallback={<GameLinkPageSkeleton />}>
    <GameLinkPage />
  </Suspense>
);

export default LinkRoute;
