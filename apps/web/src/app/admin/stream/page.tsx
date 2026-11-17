import type { Metadata } from "next";
import { StreamPage } from "@/src/lib/pages/StreamPage";

export const metadata: Metadata = {
  title: "MoonStream",
};

const StreamHostPage = () => <StreamPage />;

export default StreamHostPage;
