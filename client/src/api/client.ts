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
  register: (email: string, password: string, name: string) =>
    request<any>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  anonymous: (email: string, name?: string) =>
    request<any>('/auth/anonymous', { method: 'POST', body: JSON.stringify({ email, name }) }),
  me: () => request<any>('/auth/me'),
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
