import { Suspense } from "react";
import { Admin, AdminSkeleton } from "@/src/lib/pages/Admin";

const AdminTabPage = () => (
  <Suspense fallback={<AdminSkeleton tab="comments" />}>
    <Admin tab="comments" />
  </Suspense>
);

export default AdminTabPage;
