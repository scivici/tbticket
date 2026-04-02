// ============ Enums ============

export type TicketStatus = 'new' | 'analyzing' | 'assigned' | 'in_progress' | 'waiting_for_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type UserRole = 'customer' | 'admin';
export type QuestionType = 'text' | 'textarea' | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'number' | 'date' | 'file';

// ============ Auth ============

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  isAnonymous: boolean;
}

export interface AuthPayload {
  userId: number;
  email: string;
  role: UserRole;
  isAnonymous: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AnonymousRequest {
  email: string;
  name?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ============ Products ============

export interface Product {
  id: number;
  name: string;
  model: string;
  description: string;
  imageUrl?: string;
}

export interface ProductCategory {
  id: number;
  productId: number;
  name: string;
  description: string;
  icon?: string;
}

export interface QuestionTemplate {
  id: number;
  categoryId: number;
  questionText: string;
  questionType: QuestionType;
  options?: string; // JSON string for select/radio/multiselect
  isRequired: boolean;
  displayOrder: number;
  conditionalOn?: number; // question_template id
  conditionalValue?: string;
  placeholder?: string;
  validationRules?: string; // JSON string
}

// ============ Tickets ============

export interface Ticket {
  id: number;
  ticketNumber: string;
  customerId: number;
  productId: number;
  categoryId: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedEngineerId?: number;
  aiAnalysis?: string; // JSON string
  aiConfidence?: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface TicketAnswer {
  id: number;
  ticketId: number;
  questionTemplateId: number;
  answer: string;
}

export interface TicketAttachment {
  id: number;
  ticketId: number;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
}

export interface CreateTicketRequest {
  productId: number;
  categoryId: number;
  subject: string;
  description: string;
  answers: { questionTemplateId: number; answer: string }[];
  email?: string;
  name?: string;
}

export interface TicketDetail extends Ticket {
  product: Product;
  category: ProductCategory;
  answers: (TicketAnswer & { questionText: string; questionType: QuestionType })[];
  attachments: TicketAttachment[];
  assignedEngineer?: Engineer;
  customer: { id: number; email: string; name: string };
}

// ============ Engineers ============

export interface Engineer {
  id: number;
  name: string;
  email: string;
  location: string;
  isActive: boolean;
  currentWorkload: number;
  maxWorkload: number;
}

export interface Skill {
  id: number;
  name: string;
  description: string;
}

export interface EngineerSkill {
  engineerId: number;
  skillId: number;
  proficiency: number; // 1-5
}

export interface EngineerProductExpertise {
  engineerId: number;
  productId: number;
  categoryId?: number;
  expertiseLevel: number; // 1-5
}

// ============ AI Analysis ============

export interface AIAnalysisResult {
  classification: string;
  severity: TicketPriority;
  rootCauseHypothesis: string;
  recommendedEngineerId: number;
  recommendedEngineerName: string;
  confidence: number;
  reasoning: string;
  suggestedSkills: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

// ============ Admin / Dashboard ============

export interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  avgResolutionTime: number;
  ticketsByStatus: Record<TicketStatus, number>;
  ticketsByPriority: Record<TicketPriority, number>;
  ticketsByProduct: { productName: string; count: number }[];
  engineerWorkloads: { engineerName: string; current: number; max: number }[];
}
