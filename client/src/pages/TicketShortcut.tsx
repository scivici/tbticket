import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotFound from './NotFound';

const TICKET_NUMBER_RE = /^TBT-[A-Z0-9]+-[A-Z0-9]+$/i;

export default function TicketShortcut() {
  const { ticketNumber } = useParams<{ ticketNumber: string }>();
  const { user, isStaff, loading } = useAuth();

  if (!ticketNumber || !TICKET_NUMBER_RE.test(ticketNumber)) {
    return <NotFound />;
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  const normalized = ticketNumber.toUpperCase();

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent('/' + normalized)}`} replace />;
  }

  if (isStaff) {
    return <Navigate to={`/admin/tickets/${normalized}`} replace />;
  }

  return <Navigate to={`/my-tickets/${normalized}`} replace />;
}
