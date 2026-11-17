import type { Metadata } from "next";
import { StreamWatchPage } from "@/src/lib/pages/StreamWatchPage";

export const metadata: Metadata = {
  title: "Watch a stream",
};

const StreamWatchIndexPage = () => <StreamWatchPage />;

export default StreamWatchIndexPage;
