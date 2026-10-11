import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth } from "./components/guards";
import { Spinner } from "./components/ui";

const Welcome = lazy(() => import("./features/onboarding/Welcome"));
const SignUp = lazy(() => import("./features/onboarding/SignUp"));
const Story = lazy(() => import("./features/onboarding/Story"));
const Garage = lazy(() => import("./features/garage/Garage"));
const AddVehicle = lazy(() => import("./features/garage/AddVehicle"));
const VehicleDetail = lazy(() => import("./features/garage/VehicleDetail"));
const Explore = lazy(() => import("./features/explore/Explore"));
const Passport = lazy(() => import("./features/explore/Passport"));
const DreamGarage = lazy(() => import("./features/explore/DreamGarage"));
const Capture = lazy(() => import("./features/explore/Capture"));
const Experiences = lazy(() => import("./features/explore/Experiences"));
const Roadmap = lazy(() => import("./features/roadmap/Roadmap"));
const Compare = lazy(() => import("./features/roadmap/Compare"));
const RoadTo = lazy(() => import("./features/roadmap/RoadTo"));
const Profile = lazy(() => import("./features/profile/Profile"));
const Ops = lazy(() => import("./features/profile/Ops"));
const FinanceRoutes = lazy(() => import("./features/finance/FinanceRoutes"));
const MockProvider = lazy(() => import("./features/finance/MockProvider"));

export default function App() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-white focus:p-3 focus:font-bold">Skip to content</a>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/mock/:provider" element={<MockProvider />} />
          <Route path="/finance/*" element={<FinanceRoutes />} />

          <Route element={<AppShell />}>
            <Route path="/explore" element={<Explore />} />
            <Route path="/explore/:modelId" element={<Passport />} />
            <Route path="/capture" element={<Capture />} />
            <Route path="/experiences" element={<Experiences />} />
            <Route element={<RequireAuth />}>
              <Route path="/story" element={<Story />} />
              <Route path="/garage" element={<Garage />} />
              <Route path="/garage/add" element={<AddVehicle />} />
              <Route path="/garage/:id" element={<VehicleDetail />} />
              <Route path="/dream" element={<DreamGarage />} />
              <Route path="/roadmap" element={<Roadmap />} />
              <Route path="/roadmap/compare" element={<Compare />} />
              <Route path="/roadmap/goal/:id" element={<RoadTo />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route element={<RequireAuth role="ops" />}>
              <Route path="/ops" element={<Ops />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
