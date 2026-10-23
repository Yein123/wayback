import { Suspense } from "react";
import LocateFlow from "./LocateFlow";

export default function LocatePage() {
  return (
    <Suspense>
      <LocateFlow />
    </Suspense>
  );
}
