"use client";
import { ReactNode } from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/src/lib/shared/store/auth.store";
import { Box } from "@/src/lib/shared/ui/Box";
import { Breadcrumbs } from "@/src/lib/shared/ui/Breadcrumbs";
import { Tabs } from "@/src/lib/shared/ui/Tabs";
import { AdminSkeleton } from "./AdminSkeleton";
import { UserList } from "@/src/lib/widgets/admin/UserList";
import { GameList } from "@/src/lib/widgets/admin/GameList";
import { ReportList } from "@/src/lib/widgets/admin/ReportList";
import { CommentList } from "@/src/lib/widgets/admin/CommentList";
import { Conflicts } from "@/src/lib/widgets/admin/Conflicts";
import { RequestsReview } from "@/src/lib/widgets/admin/RequestsReview";
import { CharactersAdmin } from "@/src/lib/widgets/admin/CharactersAdmin";
import { ImageGenerator } from "@/src/lib/widgets/admin/ImageGenerator";
import { SiteSessions } from "@/src/lib/widgets/admin/SiteSessions";
import { NewsAdmin } from "@/src/lib/widgets/admin/NewsAdmin";
import { useRequestsQuery } from "@/src/lib/entities/request/api";
import { useCommentReportsQuery } from "@/src/lib/entities/comment/api/comment-reports.queries";
import { useConflictsSummaryQuery } from "@/src/lib/entities/conflict/api";
import {
  ADMIN_HREF,
  ADMIN_TAB_LABELS,
  ADMIN_TABS,
  TAdminTab,
  getAdminHref,
  setAdminQuery,
} from "@/src/lib/shared/utils/admin-url.utils";
import styles from "./Admin.module.scss";

interface IAdminProps {
  tab: TAdminTab;
}

export const Admin = ({ tab }: IAdminProps) => {
  const router = useRouter();
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const isAuthChecked = useAuthStore((s) => s.isAuthChecked);
  const searchParams = useSearchParams();
  const tabIndex = ADMIN_TABS.indexOf(tab);
  const view = searchParams.get("view");

  const { data: gameRequests } = useRequestsQuery(
    { status: "pending", kind: "game", take: 1 },
    !!isAdmin
  );
  const { data: characterRequests } = useRequestsQuery(
    { status: "pending", kind: "character", take: 1 },
    !!isAdmin
  );
  const { data: openReports } = useCommentReportsQuery("open", 1, !!isAdmin);
  const { data: conflicts } = useConflictsSummaryQuery(undefined, !!isAdmin);
  const pendingGames = gameRequests?.total;
  const pendingCharacters = characterRequests?.total;
  const pendingReports = openReports?.total;
  const pendingConflicts = conflicts?.pending;

  if (isAuthChecked && !isAdmin) notFound();

  if (!isAdmin) return <AdminSkeleton tab={tab} />;

  const selectTab = (index: number) =>
    router.push(getAdminHref(ADMIN_TABS[index]));

  const renderSection = (
    list: ReactNode,
    extra: { view: string; label: string; count?: number; content: ReactNode }
  ) => (
    <div className={styles.section}>
      <Tabs
        defaultTabIndex={view === extra.view ? 1 : 0}
        isUseDefaultIndex
        contents={[
          { tabName: "List", onTabClick: () => setAdminQuery({ view: null }) },
          {
            tabName: extra.label,
            count: extra.count,
            onTabClick: () => setAdminQuery({ view: extra.view }),
          },
        ]}
      />
      {view === extra.view ? extra.content : list}
    </div>
  );

  const mainTabs = [
    { tabName: "Users", onTabClick: () => selectTab(0) },
    {
      tabName: "Games",
      count: pendingGames,
      onTabClick: () => selectTab(1),
    },
    {
      tabName: "Comments",
      count: pendingReports,
      onTabClick: () => selectTab(2),
    },
    {
      tabName: "Conflicts",
      count: pendingConflicts,
      onTabClick: () => selectTab(3),
    },
    {
      tabName: "Characters",
      count: pendingCharacters,
      onTabClick: () => selectTab(4),
    },
    { tabName: "Images", onTabClick: () => selectTab(5) },
    { tabName: "Sites", onTabClick: () => selectTab(6) },
    { tabName: "News", onTabClick: () => selectTab(7) },
    { tabName: "MoonStream", tabLink: "/admin/stream" },
  ];

  return (
    <Box classNameContent={styles.page}>
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Admin", href: ADMIN_HREF },
          { name: ADMIN_TAB_LABELS[tab], href: getAdminHref(tab) },
        ]}
      />
      <Tabs
        defaultTabIndex={tabIndex}
        isUseDefaultIndex
        contents={mainTabs}
        mobileMenuTitle="Admin"
      />
      {tabIndex === 0 && <UserList />}
      {tabIndex === 1 &&
        renderSection(<GameList />, {
          view: "requests",
          label: "Requests",
          count: pendingGames,
          content: <RequestsReview kind="game" />,
        })}
      {tabIndex === 2 &&
        renderSection(<CommentList />, {
          view: "reports",
          label: "Reports",
          count: pendingReports,
          content: <ReportList />,
        })}
      {tabIndex === 3 && <Conflicts />}
      {tabIndex === 4 &&
        renderSection(<CharactersAdmin />, {
          view: "requests",
          label: "Requests",
          count: pendingCharacters,
          content: <RequestsReview kind="character" />,
        })}
      {tabIndex === 5 && <ImageGenerator />}
      {tabIndex === 6 && <SiteSessions />}
      {tabIndex === 7 && <NewsAdmin />}
    </Box>
  );
};
