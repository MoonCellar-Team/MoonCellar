import { Suspense } from "react";
import { Admin, AdminSkeleton } from "@/src/lib/pages/Admin";

const AdminTabPage = () => (
  <Suspense fallback={<AdminSkeleton tab="images" />}>
    <Admin tab="images" />
  </Suspense>
);

export default AdminTabPage;
