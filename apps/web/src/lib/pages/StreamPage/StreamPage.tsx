"use client";

import { Badge } from "@/src/lib/shared/ui/Badge";
import { Box } from "@/src/lib/shared/ui/Box";
import { Breadcrumbs } from "@/src/lib/shared/ui/Breadcrumbs";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { StreamHost } from "@/src/lib/widgets/stream/StreamHost";
import styles from "./StreamPage.module.scss";

export const StreamPage = () => (
  <Box classNameContent={styles.page}>
    <Breadcrumbs
      items={[
        { name: "Home", href: "/" },
        { name: "Admin", href: "/admin" },
        { name: "MoonStream", href: "/admin/stream" },
      ]}
    />

    <header className={styles.head}>
      <div className={styles.head__text}>
        <span className={styles.eyebrow}>Admin tool</span>
        <h1 className={styles.title}>MoonStream</h1>
        <p className={styles.text}>
          Share a screen with another computer through MoonCellar. One code is
          the whole invite: the other admin opens the link, enters the code and
          watches in the browser. No install, no plugin.
        </p>
      </div>
      <div className={styles.head__aside}>
        <Badge tone="accent">Admins only</Badge>
        <Button
          color={ButtonColor.DEFAULT}
          href="/admin/stream/watch"
          target="_blank"
          rel="noreferrer"
        >
          Watch a stream
        </Button>
      </div>
    </header>

    <StreamHost />
  </Box>
);
