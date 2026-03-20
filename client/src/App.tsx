import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
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

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="text-center py-12">Loading...</div>;
  return isAdmin ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/submit" element={<WizardContainer />} />
        <Route path="/track" element={<TicketTracker />} />
        <Route path="/my-tickets" element={<MyTickets />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminRoute><Dashboard /></AdminRoute>} />
        <Route path="/admin/tickets" element={<AdminRoute><TicketList /></AdminRoute>} />
        <Route path="/admin/tickets/:id" element={<AdminRoute><TicketDetail /></AdminRoute>} />
        <Route path="/admin/engineers" element={<AdminRoute><EngineerManager /></AdminRoute>} />
        <Route path="/admin/products" element={<AdminRoute><ProductManager /></AdminRoute>} />
        <Route path="/admin/categories" element={<AdminRoute><CategoryManager /></AdminRoute>} />
        <Route path="/admin/questions" element={<AdminRoute><QuestionManager /></AdminRoute>} />
        <Route path="/admin/skills" element={<AdminRoute><SkillManager /></AdminRoute>} />
      </Route>
    </Routes>
  );
}
