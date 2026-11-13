import { Metadata } from "next";
import { Suspense } from "react";
import { OAuthCallbackPage } from "@/src/lib/pages/OAuthCallbackPage";

export const metadata: Metadata = {
  title: "Signing in",
  robots: { index: false, follow: false },
};

const OAuthCallbackRoute = () => (
  <Suspense>
    <OAuthCallbackPage />
  </Suspense>
);

export default OAuthCallbackRoute;
