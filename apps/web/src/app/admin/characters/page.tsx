import { Suspense } from "react";
import { Admin, AdminSkeleton } from "@/src/lib/pages/Admin";

const AdminTabPage = () => (
  <Suspense fallback={<AdminSkeleton tab="characters" />}>
    <Admin tab="characters" />
  </Suspense>
);

export default AdminTabPage;
