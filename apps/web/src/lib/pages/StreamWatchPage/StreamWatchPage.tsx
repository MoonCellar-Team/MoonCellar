"use client";

import { Box } from "@/src/lib/shared/ui/Box";
import { Breadcrumbs } from "@/src/lib/shared/ui/Breadcrumbs";
import { StreamViewer } from "@/src/lib/widgets/stream/StreamViewer";
import styles from "./StreamWatchPage.module.scss";

interface IStreamWatchPageProps {
  code?: string;
}

export const StreamWatchPage = ({ code }: IStreamWatchPageProps) => (
  <Box classNameContent={styles.page}>
    <Breadcrumbs
      items={[
        { name: "Home", href: "/" },
        { name: "Admin", href: "/admin" },
        { name: "MoonStream", href: "/admin/stream" },
        { name: "Watch", href: "/admin/stream/watch" },
      ]}
    />

    <StreamViewer code={code} />
  </Box>
);
