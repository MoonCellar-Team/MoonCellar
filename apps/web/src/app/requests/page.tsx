import { Metadata } from "next";
import { Suspense } from "react";
import {
  RequestsPage,
  RequestsPageSkeleton,
} from "@/src/lib/pages/RequestsPage";

export const metadata: Metadata = {
  title: "Requests",
  description: "Suggest a new game or character, or a correction",
  robots: { index: false, follow: true },
};

const RequestsRoute = () => (
  <Suspense fallback={<RequestsPageSkeleton />}>
    <RequestsPage />
  </Suspense>
);

export default RequestsRoute;
