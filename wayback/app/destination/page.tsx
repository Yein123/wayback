import { Suspense } from "react";
import DestinationForm from "./DestinationForm";

export default function DestinationPage() {
  return (
    <Suspense>
      <DestinationForm />
    </Suspense>
  );
}
