import { Suspense } from "react";
import { Admin, AdminSkeleton } from "@/src/lib/pages/Admin";

const AdminTabPage = () => (
  <Suspense fallback={<AdminSkeleton tab="sites" />}>
    <Admin tab="sites" />
  </Suspense>
);

export default AdminTabPage;
