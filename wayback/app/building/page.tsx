import { Suspense } from "react";
import BuildingView from "./BuildingView";

export default function BuildingPage() {
  return (
    <Suspense>
      <BuildingView />
    </Suspense>
  );
}
