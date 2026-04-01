import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import CompanyUsers from './pages/CompanyUsers';
import TicketTracker from './pages/TicketTracker';
import MyTickets from './pages/MyTickets';
import CustomerTicketDetail from './pages/CustomerTicketDetail';
import ProfilePage from './pages/ProfilePage';
import WizardContainer from './pages/TicketWizard/WizardContainer';
import ReleaseNotes from './pages/ReleaseNotes';
import KnowledgeBase from './pages/KnowledgeBase';
import Dashboard from './pages/admin/Dashboard';
import TicketList from './pages/admin/TicketList';
import TicketDetail from './pages/admin/TicketDetail';
import EngineerManager from './pages/admin/EngineerManager';
import ProductManager from './pages/admin/ProductManager';
import CategoryManager from './pages/admin/CategoryManager';
import QuestionManager from './pages/admin/QuestionManager';
import SkillManager from './pages/admin/SkillManager';
import UserManager from './pages/admin/UserManager';
import SetupPage from './pages/admin/SetupPage';
import CustomerList from './pages/admin/CustomerList';
import CannedResponseManager from './pages/admin/CannedResponseManager';
import EscalationManager from './pages/admin/EscalationManager';
import RecurringTickets from './pages/admin/RecurringTickets';
import TimeReports from './pages/admin/TimeReports';
import SlaDashboard from './pages/admin/SlaDashboard';
import HealthDashboard from './pages/admin/HealthDashboard';
import TicketPrint from './pages/admin/TicketPrint';
import HelpGuide from './pages/admin/HelpGuide';
import AiUsage from './pages/admin/AiUsage';
import NotFound from './pages/NotFound';

function AuthGuard({ children, denyRoles }: { children: React.ReactElement; denyRoles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#f2f2f2] dark:bg-tb-bg flex items-center justify-center text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (denyRoles?.includes(user.role)) return <Navigate to="/admin" />;
  return children;
}

function AdminGuard() {
  const { isStaff, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#f2f2f2] dark:bg-tb-bg flex items-center justify-center text-gray-500">Loading...</div>;
  return isStaff ? <AdminLayout /> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/company/users" element={<AuthGuard><CompanyUsers /></AuthGuard>} />
        <Route path="/submit" element={<AuthGuard denyRoles={['engineer']}><WizardContainer /></AuthGuard>} />
        <Route path="/track" element={<TicketTracker />} />
        <Route path="/release-notes" element={<ReleaseNotes />} />
        <Route path="/knowledge-base" element={<KnowledgeBase />} />
        <Route path="/my-tickets" element={<MyTickets />} />
        <Route path="/my-tickets/:id" element={<CustomerTicketDetail />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Admin Pages — separate layout with sidebar */}
      <Route element={<AdminGuard />}>
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/tickets" element={<TicketList />} />
        <Route path="/admin/tickets/:id" element={<TicketDetail />} />
        <Route path="/admin/engineers" element={<EngineerManager />} />
        <Route path="/admin/customers" element={<CustomerList />} />
        <Route path="/admin/products" element={<ProductManager />} />
        <Route path="/admin/categories" element={<CategoryManager />} />
        <Route path="/admin/questions" element={<QuestionManager />} />
        <Route path="/admin/skills" element={<SkillManager />} />
        <Route path="/admin/canned-responses" element={<CannedResponseManager />} />
        <Route path="/admin/escalations" element={<EscalationManager />} />
        <Route path="/admin/recurring" element={<RecurringTickets />} />
        <Route path="/admin/time-reports" element={<TimeReports />} />
        <Route path="/admin/sla-dashboard" element={<SlaDashboard />} />
        <Route path="/admin/health" element={<HealthDashboard />} />
        <Route path="/admin/tickets/:id/print" element={<TicketPrint />} />
        <Route path="/admin/users" element={<Navigate to="/admin/setup" />} />
        <Route path="/admin/setup" element={<SetupPage />} />
        <Route path="/admin/ai-usage" element={<AiUsage />} />
        <Route path="/admin/help" element={<HelpGuide />} />
      </Route>

      {/* 404 catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
