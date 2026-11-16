import { Suspense } from "react";
import { Admin, AdminSkeleton } from "@/src/lib/pages/Admin";

const AdminTabPage = () => (
  <Suspense fallback={<AdminSkeleton tab="games" />}>
    <Admin tab="games" />
  </Suspense>
);

export default AdminTabPage;
