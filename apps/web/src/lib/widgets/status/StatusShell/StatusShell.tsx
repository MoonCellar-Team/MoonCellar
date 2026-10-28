"use client";

import { FC, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useProjectsQuery } from "@/src/lib/entities/project/api";
import { useAuth } from "@/src/lib/shared/hooks/auth";
import { Box } from "@/src/lib/shared/ui/Box";
import { Button, ButtonColor } from "@/src/lib/shared/ui/Button";
import { STATUS_SIGN_IN_PATH } from "@/src/lib/shared/utils/status-path.utils";
import { ProjectsMenu } from "@/src/lib/widgets/status/ProjectsMenu";
import styles from "./StatusShell.module.scss";

export interface IStatusViewer {
  id: string;
  userName: string;
}

interface IStatusShellProps {
  viewer: IStatusViewer;
  children: ReactNode;
}

export const StatusShell: FC<IStatusShellProps> = ({ viewer, children }) => {
  const current = useSelectedLayoutSegment();
  const { data: projects = [], isLoading } = useProjectsQuery();
  const { logout } = useAuth();

  return (
    <div className={styles.shell}>
      <Box>
        <div className={styles.topbar}>
          <Link
            href="/"
            className={styles.topbar__brand}
            aria-label="Status home"
          >
            <Image
              src="/images/logo-text.png"
              alt="MoonCellar"
              width={747}
              height={165}
              priority
              className={styles.topbar__logo}
            />
            <span className={styles.topbar__label}>Status</span>
          </Link>
          <div className={styles.topbar__user}>
            <span>{viewer.userName}</span>
            <Button
              color={ButtonColor.TRANSPARENT}
              onClick={() => logout(viewer.id, { href: STATUS_SIGN_IN_PATH })}
            >
              Sign out
            </Button>
          </div>
        </div>
      </Box>
      <div className={styles.body}>
        <ProjectsMenu
          projects={projects}
          isLoading={isLoading}
          current={current}
        />
        <div className={styles.body__main}>{children}</div>
      </div>
    </div>
  );
};
