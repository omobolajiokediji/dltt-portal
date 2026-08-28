export type UserRole = 'super-admin' | 'admin' | 'master-trainer' | 'senior-trainer' | 'trainer' | 'teacher';
export type GrowthRole = 'teacher' | 'trainer' | 'senior-trainer' | 'master-trainer';

export interface CertificationApproval {
  approved: boolean;
  approvedAt?: string;
  approvedBy?: string;
}

export interface PerformanceSnapshot {
  totalScore: number;
  completionRate: number;
  attendanceCount: number;
  completedWeeklyTests: number;
  submittedAssignments: number;
  capturedAt: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  state: string;
  trainerId?: string;
  createdBy?: string;
  promotedAt?: string;
  archived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  school?: string;
  gender?: string;
  lastLoginAt?: string;
  profilePhoto?: string;
  certificateName?: string;
  approvedForCertificate: boolean;
  certifications?: Partial<Record<GrowthRole, CertificationApproval>>;
  performanceHistory?: Partial<Record<GrowthRole, PerformanceSnapshot>>;
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
  rankRoleMigrationCompletedAt?: string;
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
  createdBy?: string;
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

export interface ImportedScoreRow {
  teacherEmail: string;
  score: number;
  week?: number;
  feedback?: string;
  materialId?: string;
  materialTitle?: string;
  contentUrl?: string;
  submittedAt?: string;
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

export interface StateGrowthStats {
  state: string;
  teachers: number;
  trainers: number;
  seniorTrainers: number;
  masterTrainers: number;
  total: number;
}

export interface RoleDashboardStats {
  stateDistribution: TeacherStateStats[];
  genderDistribution: GenderDistributionItem[];
  leaderboard: { name: string; score: number; state: string }[];
}

export interface TrainingStats {
  enrollment: number;
  trainerCount: number;
  seniorTrainerCount: number;
  masterTrainerCount: number;
  completionRate: number;
  activeTeachers: number;
  genderDistribution: GenderDistributionItem[];
  stateLeaderboard: { state: string; score: number }[];
  teachersByState: TeacherStateStats[];
  growthByState: StateGrowthStats[];
  teacherLeaderboard: { name: string; score: number; state: string }[];
  roleBreakdowns?: Partial<Record<GrowthRole, RoleDashboardStats>>;
  levelLeaderboards: {
    role: GrowthRole;
    title: string;
    count: number;
    performers: { name: string; score: number; state: string }[];
  }[];
}
