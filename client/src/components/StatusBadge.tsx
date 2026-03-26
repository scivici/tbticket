import React from 'react';

const statusColors: Record<string, string> = {
  new: 'bg-status-info-bg text-status-info-text',
  analyzing: 'bg-purple-200 text-purple-800',
  assigned: 'bg-status-warn-bg text-status-warn-text',
  in_progress: 'bg-amber-100 text-amber-800',
  pending_info: 'bg-gray-200 text-gray-700',
  escalated_to_jira: 'bg-orange-200 text-orange-800',
  resolved: 'bg-status-active-bg text-status-active-text',
  closed: 'bg-gray-300 text-gray-600',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-200 text-gray-700',
  medium: 'bg-status-info-bg text-status-info-text',
  high: 'bg-status-warn-bg text-status-warn-text',
  critical: 'bg-status-expired-bg text-status-expired-text',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-200 text-gray-700'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityColors[priority] || 'bg-gray-200 text-gray-700'}`}>
      {priority}
    </span>
  );
}
