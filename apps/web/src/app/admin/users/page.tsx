import { Suspense } from "react";
import { Admin, AdminSkeleton } from "@/src/lib/pages/Admin";

const AdminTabPage = () => (
  <Suspense fallback={<AdminSkeleton tab="users" />}>
    <Admin tab="users" />
  </Suspense>
);

export default AdminTabPage;
