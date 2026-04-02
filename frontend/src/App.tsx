import { useState, useCallback } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "./components/Layout";
import { SplashScreen } from "@/components/ui/splash-screen";
import { CustomCursor } from "@/components/ui/custom-cursor";
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

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};
const pageTrans = { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const };

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTrans}
      >
        <Routes location={location}>
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
      </motion.div>
    </AnimatePresence>
  );
}

export function App() {
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  return (
    <>
      <CustomCursor />
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
      <motion.div
        initial={{ opacity: 0 }}
        animate={splashDone ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <AnimatedRoutes />
      </motion.div>
    </>
  );
}
