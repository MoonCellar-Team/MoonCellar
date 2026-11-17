import type { Metadata } from "next";
import { StreamWatchPage } from "@/src/lib/pages/StreamWatchPage";

export const metadata: Metadata = {
  title: "Watch a stream",
};

const StreamWatchCodePage = async ({
  params,
}: {
  params: Promise<{ code: string }>;
}) => {
  const { code } = await params;

  return <StreamWatchPage code={code} />;
};

export default StreamWatchCodePage;
