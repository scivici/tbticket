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
  track: (ticketNumber: string) => request<any>(`/tickets/track/${ticketNumber}`),
  updateStatus: (id: number, status: string) =>
    request<any>(`/tickets/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  assign: (id: number, engineerId: number) =>
    request<any>(`/tickets/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ engineerId }) }),
  analyze: (id: number) =>
    request<any>(`/tickets/${id}/analyze`, { method: 'POST' }),
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
  escalationRules: () => request<any[]>('/admin/escalation-rules'),
  createEscalationRule: (data: any) =>
    request<any>('/admin/escalation-rules', { method: 'POST', body: JSON.stringify(data) }),
  updateEscalationRule: (id: number, data: any) =>
    request<any>(`/admin/escalation-rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteEscalationRule: (id: number) =>
    request<any>(`/admin/escalation-rules/${id}`, { method: 'DELETE' }),
  escalationAlerts: () => request<any[]>('/admin/escalation-alerts'),
  recurringTickets: (minCount?: number, daysBack?: number) => {
    const params = new URLSearchParams();
    if (minCount) params.set('minCount', String(minCount));
    if (daysBack) params.set('daysBack', String(daysBack));
    return request<any[]>(`/admin/recurring-tickets?${params}`);
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
