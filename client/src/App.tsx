import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TicketTracker from './pages/TicketTracker';
import MyTickets from './pages/MyTickets';
import WizardContainer from './pages/TicketWizard/WizardContainer';
import Dashboard from './pages/admin/Dashboard';
import TicketList from './pages/admin/TicketList';
import TicketDetail from './pages/admin/TicketDetail';
import EngineerManager from './pages/admin/EngineerManager';
import ProductManager from './pages/admin/ProductManager';
import CategoryManager from './pages/admin/CategoryManager';
import QuestionManager from './pages/admin/QuestionManager';
import SkillManager from './pages/admin/SkillManager';

function AdminGuard() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#f2f2f2] dark:bg-tb-bg flex items-center justify-center text-gray-500">Loading...</div>;
  return isAdmin ? <AdminLayout /> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/submit" element={<WizardContainer />} />
        <Route path="/track" element={<TicketTracker />} />
        <Route path="/my-tickets" element={<MyTickets />} />
      </Route>

      {/* Admin Pages — separate layout with sidebar */}
      <Route element={<AdminGuard />}>
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/tickets" element={<TicketList />} />
        <Route path="/admin/tickets/:id" element={<TicketDetail />} />
        <Route path="/admin/engineers" element={<EngineerManager />} />
        <Route path="/admin/products" element={<ProductManager />} />
        <Route path="/admin/categories" element={<CategoryManager />} />
        <Route path="/admin/questions" element={<QuestionManager />} />
        <Route path="/admin/skills" element={<SkillManager />} />
      </Route>
    </Routes>
  );
}
