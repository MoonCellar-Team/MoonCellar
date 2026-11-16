import { Suspense } from "react";
import { Admin, AdminSkeleton } from "@/src/lib/pages/Admin";

const AdminTabPage = () => (
  <Suspense fallback={<AdminSkeleton tab="conflicts" />}>
    <Admin tab="conflicts" />
  </Suspense>
);

export default AdminTabPage;
