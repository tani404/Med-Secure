import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import {
  BatchDetailPage,
  BatchTimelineLookupPage,
  CreateBatchPage,
  DistributorDashboardPage,
  LandingPage,
  MarkAsSoldPage,
  MyBatchesPage,
  PharmacyDashboardPage,
  RolePortalPage,
  TransferToDistributorPage,
  TransferToPharmacyPage,
  VerifyPage
} from "./pages/Pages";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="portal" element={<RolePortalPage />} />
        <Route path="verify" element={<VerifyPage />} />
        <Route path="manufacturer" element={<Navigate to="/manufacturer/create" replace />} />
        <Route path="manufacturer/create" element={<CreateBatchPage />} />
        <Route path="manufacturer/batches" element={<MyBatchesPage />} />
        <Route path="manufacturer/assign" element={<TransferToDistributorPage />} />
        <Route path="distributor" element={<DistributorDashboardPage />} />
        <Route path="distributor/transfer" element={<TransferToPharmacyPage />} />
        <Route path="distributor/timeline" element={<BatchTimelineLookupPage context="distributor" />} />
        <Route path="pharmacy" element={<PharmacyDashboardPage />} />
        <Route path="pharmacy/sell" element={<MarkAsSoldPage />} />
        <Route path="pharmacy/timeline" element={<BatchTimelineLookupPage context="pharmacy" />} />
        <Route path="batch/:batchId" element={<BatchDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
