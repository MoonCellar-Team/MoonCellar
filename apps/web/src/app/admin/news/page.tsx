import { Suspense } from "react";
import { Admin, AdminSkeleton } from "@/src/lib/pages/Admin";

const AdminTabPage = () => (
  <Suspense fallback={<AdminSkeleton tab="news" />}>
    <Admin tab="news" />
  </Suspense>
);

export default AdminTabPage;
