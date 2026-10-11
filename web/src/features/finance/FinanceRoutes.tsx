import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "@/components/guards";
import Intake from "./Intake";
import { KfsPage, Offers } from "./Offers";
import Recovery from "./Recovery";
import Remediation from "./Remediation";
import StepPage from "./StepPage";
import { Disbursal, FinanceRouter, Handoff, ReturnPage, Status } from "./StatusPages";

/** The finance journey is a separate onboarding, entered only through an explicit "Explore financing". */
export default function FinanceRoutes() {
  return (
    <Routes>
      <Route element={<RequireAuth />}>
        <Route path="start" element={<Intake />} />
        <Route path="blocked" element={<Recovery />} />
        <Route path=":id" element={<FinanceRouter />} />
        <Route path=":id/step/:step" element={<StepPage />} />
        <Route path=":id/remediation" element={<Remediation />} />
        <Route path=":id/status" element={<Status />} />
        <Route path=":id/offers" element={<Offers />} />
        <Route path=":id/offers/:oid" element={<KfsPage />} />
        <Route path=":id/disbursal" element={<Disbursal />} />
        <Route path=":id/handoff" element={<Handoff />} />
        <Route path=":id/recovery" element={<Recovery />} />
        <Route path=":id/return" element={<ReturnPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/roadmap" replace />} />
    </Routes>
  );
}
