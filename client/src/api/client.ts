const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Only set Content-Type for non-FormData bodies
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<any>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, name: string, company?: string) =>
    request<any>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name, company }) }),
  anonymous: (email: string, name?: string) =>
    request<any>('/auth/anonymous', { method: 'POST', body: JSON.stringify({ email, name }) }),
  me: () => request<any>('/auth/me'),
  updateProfile: (data: { name?: string; company?: string }) =>
    request<any>('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<any>('/auth/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),
};

// Products
export const products = {
  list: () => request<any[]>('/products'),
  categories: (productId: number) => request<any[]>(`/products/${productId}/categories`),
  questions: (categoryId: number) => request<any[]>(`/products/categories/${categoryId}/questions`),
  releaseNotes: () => request<any[]>('/products/release-notes'),
};

// Tickets
export const tickets = {
  create: (formData: FormData) =>
    request<any>('/tickets', { method: 'POST', body: formData }),
  list: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/tickets${query}`);
  },
  get: (id: number) => request<any>(`/tickets/${id}`),
  getByNumber: (ticketNumber: string) => request<any>(`/tickets/${encodeURIComponent(ticketNumber)}`),
  track: (ticketNumber: string) => request<any>(`/tickets/track/${ticketNumber}`),
  updateStatus: (id: number, status: string) =>
    request<any>(`/tickets/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  assign: (id: number, engineerId: number) =>
    request<any>(`/tickets/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ engineerId }) }),
  analyze: (id: number, customPrompt?: string) =>
    request<any>(`/tickets/${id}/analyze`, { method: 'POST', body: JSON.stringify({ customPrompt }) }),
  addAttachments: (id: number, formData: FormData) =>
    request<any>(`/tickets/${id}/attachments`, { method: 'POST', body: formData }),
  getResponses: (id: number) => request<any[]>(`/tickets/${id}/responses`),
  addResponse: (id: number, message: string, isInternal?: boolean) =>
    request<any>(`/tickets/${id}/responses`, { method: 'POST', body: JSON.stringify({ message, isInternal: isInternal || false }) }),
  delete: (id: number) => request<any>(`/tickets/${id}`, { method: 'DELETE' }),
  updatePriority: (id: number, priority: string) =>
    request<any>(`/tickets/${id}/priority`, { method: 'PATCH', body: JSON.stringify({ priority }) }),
  bulkStatus: (ticketIds: number[], status: string) =>
    request<any>('/tickets/bulk/status', { method: 'POST', body: JSON.stringify({ ticketIds, status }) }),
  bulkAssign: (ticketIds: number[], engineerId: number) =>
    request<any>('/tickets/bulk/assign', { method: 'POST', body: JSON.stringify({ ticketIds, engineerId }) }),
  bulkDelete: (ticketIds: number[]) =>
    request<any>('/tickets/bulk/delete', { method: 'POST', body: JSON.stringify({ ticketIds }) }),
  // CC users
  getCcUsers: (id: number) => request<any[]>(`/tickets/${id}/cc`),
  addCcUser: (id: number, email: string, name?: string) =>
    request<any>(`/tickets/${id}/cc`, { method: 'POST', body: JSON.stringify({ email, name }) }),
  removeCcUser: (id: number, email: string) =>
    request<any>(`/tickets/${id}/cc/${encodeURIComponent(email)}`, { method: 'DELETE' }),

  // Linked tickets
  getLinkedTickets: (id: number) => request<any[]>(`/tickets/${id}/links`),
  linkTicket: (id: number, linkedTicketId: string | number, linkType?: string) =>
    request<any>(`/tickets/${id}/links`, { method: 'POST', body: JSON.stringify({ linkedTicketId, linkType }) }),
  unlinkTicket: (id: number, linkId: number) =>
    request<any>(`/tickets/${id}/links/${linkId}`, { method: 'DELETE' }),

  // Jira
  updateJiraKey: (id: number, jiraIssueKey: string) =>
    request<any>(`/tickets/${id}/jira`, { method: 'PATCH', body: JSON.stringify({ jiraIssueKey }) }),
  escalateToJira: (id: number) =>
    request<any>(`/tickets/${id}/escalate-jira`, { method: 'POST' }),
  getJiraStatus: (id: number) => request<any>(`/tickets/${id}/jira-status`),

  // Time entries
  getTimeEntries: (id: number) => request<any[]>(`/tickets/${id}/time-entries`),
  addTimeEntry: (id: number, data: { hours: number; description: string; isChargeable?: boolean; engineerId?: number; date?: string; activityType?: string }) =>
    request<any>(`/tickets/${id}/time-entries`, { method: 'POST', body: JSON.stringify(data) }),
  deleteTimeEntry: (id: number, entryId: number) =>
    request<any>(`/tickets/${id}/time-entries/${entryId}`, { method: 'DELETE' }),

  // Timer
  startTimer: (id: number, data?: { activityType?: string; description?: string }) =>
    request<any>(`/tickets/${id}/timer/start`, { method: 'POST', body: JSON.stringify(data || {}) }),
  stopTimer: (id: number, data?: { description?: string; isChargeable?: boolean }) =>
    request<any>(`/tickets/${id}/timer/stop`, { method: 'POST', body: JSON.stringify(data || {}) }),
  cancelTimer: (id: number) =>
    request<any>(`/tickets/${id}/timer`, { method: 'DELETE' }),
  getActiveTimer: () => request<any>('/tickets/timer/active'),

  // AI suggestion
  suggestReply: (id: number) => request<any>(`/tickets/${id}/suggest-reply`, { method: 'POST' }),
  // Knowledge base
  createKbArticle: (id: number, data?: { title?: string; content?: string }) =>
    request<any>(`/tickets/${id}/create-kb-article`, { method: 'POST', body: JSON.stringify(data || {}) }),

  extractAttachmentData: (id: number, attachmentId: number) =>
    request<any>(`/tickets/${id}/extract-data/${attachmentId}`, { method: 'POST' }),
  getActivities: (id: number) => request<any[]>(`/tickets/${id}/activities`),
  getTags: (id: number) => request<string[]>(`/tickets/${id}/tags`),
  addTag: (id: number, tag: string) =>
    request<any>(`/tickets/${id}/tags`, { method: 'POST', body: JSON.stringify({ tag }) }),
  removeTag: (id: number, tag: string) =>
    request<any>(`/tickets/${id}/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' }),
  submitSatisfaction: (id: number, rating: number, comment?: string) =>
    request<any>(`/tickets/${id}/satisfaction`, { method: 'POST', body: JSON.stringify({ rating, comment }) }),
  getSatisfaction: (id: number) =>
    request<any>(`/tickets/${id}/satisfaction`),
  mergeTicket: (id: number, sourceTicketId: number) =>
    request<any>(`/tickets/${id}/merge`, { method: 'POST', body: JSON.stringify({ sourceTicketId }) }),
};

// Engineers
export const engineers = {
  list: () => request<any[]>('/engineers'),
  get: (id: number) => request<any>(`/engineers/${id}`),
  create: (data: any) =>
    request<any>('/engineers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) =>
    request<any>(`/engineers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<any>(`/engineers/${id}`, { method: 'DELETE' }),
  updateSkills: (id: number, skills: any[]) =>
    request<any>(`/engineers/${id}/skills`, { method: 'PUT', body: JSON.stringify({ skills }) }),
  updateExpertise: (id: number, expertise: any[]) =>
    request<any>(`/engineers/${id}/expertise`, { method: 'PUT', body: JSON.stringify({ expertise }) }),
  skills: () => request<any[]>('/engineers/skills'),
};

// Admin
export const admin = {
  dashboard: () => request<any>('/admin/dashboard'),
  slaPolicies: () => request<any[]>('/admin/sla-policies'),
  slaBreached: () => request<any[]>('/admin/sla-breached'),
  customers: () => request<any[]>('/admin/customers'),
  getCustomer: (id: number) => request<any>(`/admin/customers/${id}`),
  customerTickets: (id: number) => request<any[]>(`/admin/customers/${id}/tickets`),
  updateCustomer: (id: number, data: any) =>
    request<any>(`/admin/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  escalationRules: () => request<any[]>('/admin/escalation-rules'),
  createEscalationRule: (data: any) =>
    request<any>('/admin/escalation-rules', { method: 'POST', body: JSON.stringify(data) }),
  updateEscalationRule: (id: number, data: any) =>
    request<any>(`/admin/escalation-rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEscalationRule: (id: number) =>
    request<any>(`/admin/escalation-rules/${id}`, { method: 'DELETE' }),
  escalationAlerts: () => request<any[]>('/admin/escalation-alerts'),
  slaCompliance: (fromDate?: string, toDate?: string) => {
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    return request<any>(`/admin/sla-compliance?${params}`);
  },
  psHoursReport: () => request<any[]>('/admin/ps-hours'),
  logRepository: (search?: string, mime?: string) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (mime) params.set('mime', mime);
    return request<any[]>(`/admin/log-repository?${params}`);
  },
  releaseNotes: () => request<any[]>('/admin/release-notes'),
  createReleaseNote: (data: { productId: number; version: string; title: string; content: string }) =>
    request<any>('/admin/release-notes', { method: 'POST', body: JSON.stringify(data) }),
  deleteReleaseNote: (id: number) => request<any>(`/admin/release-notes/${id}`, { method: 'DELETE' }),
  notifyVersionUpdate: (productId: number, version: string, releaseNotes?: string) =>
    request<any>('/admin/notify-version-update', { method: 'POST', body: JSON.stringify({ productId, version, releaseNotes }) }),
  knowledgeBase: () => request<any[]>('/admin/knowledge-base'),
  deleteKbArticle: (id: number) => request<any>(`/admin/knowledge-base/${id}`, { method: 'DELETE' }),
  timeReport: (filters?: { fromDate?: string; toDate?: string; engineerId?: string; customerId?: string; productId?: string; activityType?: string }) => {
    const params = new URLSearchParams();
    if (filters?.fromDate) params.set('fromDate', filters.fromDate);
    if (filters?.toDate) params.set('toDate', filters.toDate);
    if (filters?.engineerId) params.set('engineerId', filters.engineerId);
    if (filters?.customerId) params.set('customerId', filters.customerId);
    if (filters?.productId) params.set('productId', filters.productId);
    if (filters?.activityType) params.set('activityType', filters.activityType);
    return request<any>(`/admin/time-report?${params}`);
  },
  recurringTickets: (minCount?: number, daysBack?: number) => {
    const params = new URLSearchParams();
    if (minCount) params.set('minCount', String(minCount));
    if (daysBack) params.set('daysBack', String(daysBack));
    return request<any[]>(`/admin/recurring-tickets?${params}`);
  },
  slaDashboard: () => request<any>('/admin/sla-dashboard'),
  updateSlaPolicy: (priority: string, responseTimeHours: number, resolutionTimeHours: number) =>
    request<any>(`/admin/sla-policies/${priority}`, {
      method: 'PATCH',
      body: JSON.stringify({ responseTimeHours, resolutionTimeHours }),
    }),
  healthDashboard: () => request<any>('/admin/health-dashboard'),
  exportTicketsCsv: async () => {
    const token = localStorage.getItem('token');
    const resp = await fetch('/api/admin/export/tickets', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error('Export failed');
    const blob = await resp.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tickets-export.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  },
  exportTimeEntriesCsv: async () => {
    const token = localStorage.getItem('token');
    const resp = await fetch('/api/admin/export/time-entries', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error('Export failed');
    const blob = await resp.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'time-entries-export.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  },
};

// Admin Manage
const manage = '/admin/manage';

export const adminProducts = {
  create: (data: any) =>
    request<any>(`${manage}/products`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) =>
    request<any>(`${manage}/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<any>(`${manage}/products/${id}`, { method: 'DELETE' }),
};

export const adminCategories = {
  create: (data: any) =>
    request<any>(`${manage}/categories`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) =>
    request<any>(`${manage}/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<any>(`${manage}/categories/${id}`, { method: 'DELETE' }),
  reorder: (items: { id: number; displayOrder: number }[]) =>
    request<any>(`${manage}/categories/reorder`, { method: 'PUT', body: JSON.stringify({ items }) }),
};

export const adminQuestions = {
  list: (categoryId: number) =>
    request<any[]>(`${manage}/questions/category/${categoryId}`),
  create: (data: any) =>
    request<any>(`${manage}/questions`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) =>
    request<any>(`${manage}/questions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<any>(`${manage}/questions/${id}`, { method: 'DELETE' }),
  reorder: (items: { id: number; displayOrder: number }[]) =>
    request<any>(`${manage}/questions/reorder`, { method: 'PUT', body: JSON.stringify({ items }) }),
};

export const adminSkills = {
  list: () => request<any[]>(`${manage}/skills`),
  create: (data: any) =>
    request<any>(`${manage}/skills`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) =>
    request<any>(`${manage}/skills/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<any>(`${manage}/skills/${id}`, { method: 'DELETE' }),
};

// Canned Responses
export const cannedResponses = {
  list: () => request<any[]>('/canned-responses'),
  create: (data: { title: string; content: string; category?: string }) =>
    request<any>('/canned-responses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { title?: string; content?: string; category?: string }) =>
    request<any>(`/canned-responses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number) =>
    request<any>(`/canned-responses/${id}`, { method: 'DELETE' }),
};

// Settings
export const settings = {
  getAll: () => request<any[]>('/settings'),
  update: (settingsObj: Record<string, string>) =>
    request<any>('/settings', { method: 'PATCH', body: JSON.stringify({ settings: settingsObj }) }),
  checkLicense: (productKey: string) =>
    request<any>('/settings/check-license', { method: 'POST', body: JSON.stringify({ productKey }) }),
  testLicenseApi: (productKey: string) =>
    request<any>('/settings/test-license-api', { method: 'POST', body: JSON.stringify({ productKey }) }),
};

// Notifications
export const notifications = {
  list: () => request<any[]>('/notifications'),
  unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
  markAsRead: (id: number) => request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllAsRead: () => request<any>('/notifications/read-all', { method: 'PATCH' }),
};

// Knowledge Base (public)
export const kb = {
  list: () => request<any[]>('/kb'),
  search: (q: string) => request<any[]>(`/kb/search?q=${encodeURIComponent(q)}`),
  get: (id: number) => request<any>(`/kb/${id}`),
};

// Admin Users
export const adminUsers = {
  list: () => request<any[]>('/admin/users'),
  create: (data: { email: string; name: string; password: string }) =>
    request<any>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: { email?: string; name?: string }) =>
    request<any>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (id: number, password: string) =>
    request<any>(`/admin/users/${id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) }),
  changeMyPassword: (currentPassword: string, newPassword: string) =>
    request<any>('/admin/users/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),
  delete: (id: number) =>
    request<any>(`/admin/users/${id}`, { method: 'DELETE' }),
};
