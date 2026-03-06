import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminEvents from "./pages/admin/Events";
import AdminAthletes from "./pages/admin/Athletes";
import AdminJudges from "./pages/admin/Judges";
import AdminScores from "./pages/admin/Scores";
import AdminSettings from "./pages/admin/Settings";
import AdminAsanas from "./pages/admin/Asanas";
import JudgeScoring from "./pages/judge/Scoring";

import ChiefJudge from "./pages/ChiefJudge";
import StageManager from "./pages/StageManager";
import LiveDisplay from "./pages/LiveDisplay";
import Leaderboard from "./pages/Leaderboard";
import DevRegister from "./pages/DevRegister";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Loading...</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user && !loading ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/admin/events" element={<ProtectedRoute><AdminEvents /></ProtectedRoute>} />
      <Route path="/admin/athletes" element={<ProtectedRoute><AdminAthletes /></ProtectedRoute>} />
      <Route path="/admin/judges" element={<ProtectedRoute><AdminJudges /></ProtectedRoute>} />
      <Route path="/admin/scores" element={<ProtectedRoute><AdminScores /></ProtectedRoute>} />
      <Route path="/admin/asanas" element={<ProtectedRoute><AdminAsanas /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />

      <Route path="/judge/scoring" element={<ProtectedRoute><JudgeScoring /></ProtectedRoute>} />
      <Route path="/chief-judge" element={<ProtectedRoute><ChiefJudge /></ProtectedRoute>} />
      <Route path="/stage-manager" element={<ProtectedRoute><StageManager /></ProtectedRoute>} />
      <Route path="/live" element={<LiveDisplay />} />
      <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
      <Route path="/dev-register" element={<DevRegister />} />
      <Route path="*" element={<NotFound />} />

    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
