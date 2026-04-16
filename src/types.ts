export type UserRole = 'super-admin' | 'admin' | 'teacher';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  state: string;
  school?: string;
  profilePhoto?: string;
  certificateName?: string;
  approvedForCertificate: boolean;
  totalScore: number;
  attendance: Record<string, boolean>; // e.g., { 'week1': true }
  assignmentCompletion: Record<string, boolean>; // e.g., { 'materialId': true }
}

export interface LearningMaterial {
  id: string;
  firestoreId?: string;
  title: string;
  description: string;
  type: 'slide' | 'pdf' | 'assignment';
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

export interface TrainingStats {
  enrollment: number;
  completionRate: number;
  stateLeaderboard: { state: string; score: number }[];
  teacherLeaderboard: { name: string; score: number; state: string }[];
}
