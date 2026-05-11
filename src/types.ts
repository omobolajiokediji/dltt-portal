export type UserRole = 'super-admin' | 'admin' | 'teacher';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  state: string;
  school?: string;
  gender?: string;
  lastLoginAt?: string;
  profilePhoto?: string;
  certificateName?: string;
  approvedForCertificate: boolean;
  totalScore: number;
  attendance: Record<string, boolean>; // e.g., { 'week1': true }
  assignmentCompletion: Record<string, boolean>; // e.g., { 'materialId': true }
  accountNumber?: string;
  bank?: string;
  accountName?: string;
  teacherProfileEditingDisabled?: boolean;
}

export interface PortalSettings {
  teacherProfileEditingDisabled?: boolean;
}

export interface LearningMaterial {
  id: string;
  firestoreId?: string;
  title: string;
  description: string;
  type: 'slide' | 'pdf' | 'assignment' | 'video' | 'audio';
  contentUrl: string;
  assignedTo: string[]; // List of user IDs or 'all'
  assignedStates: string[]; // List of states or 'all'
  dueDate?: string; // ISO string for assignments
  week: number; // 1, 2, 3, 4
  createdAt: string;
}

export interface AssignmentSubmission {
  id: string;
  teacherId: string;
  materialId: string;
  contentUrl: string;
  submittedAt: string;
  score?: number;
  feedback?: string;
  status: 'pending' | 'graded';
}

export interface GenderDistributionItem {
  label: string;
  count: number;
  color: string;
}

export interface TeacherStateStats {
  state: string;
  count: number;
  activeCount: number;
  avgScore: number;
  completionRate: number;
}

export interface TrainingStats {
  enrollment: number;
  completionRate: number;
  activeTeachers: number;
  genderDistribution: GenderDistributionItem[];
  stateLeaderboard: { state: string; score: number }[];
  teachersByState: TeacherStateStats[];
  teacherLeaderboard: { name: string; score: number; state: string }[];
}
