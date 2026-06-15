import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import {
  AlertTriangle,
  AudioWaveform,
  BookOpen,
  CheckCircle,
  ChevronDown,
  Download,
  Edit,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Video,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { auth, secondaryAuth, db } from '../lib/firebase';
import { STATES, WEEKS } from '../constants';
import { AssignmentSubmission, GrowthRole, ImportedScoreRow, LearningMaterial, PortalSettings, UserProfile, UserRole } from '../types';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import {
  certificateLevelLabels,
  certificateLevelOrder,
  getCertificateLevelsForUser,
  isCertificationApproved,
} from '../lib/certificates';
import { getMaterialCreatedAtTime, sortMaterialsByNewest } from '../lib/materials';
import {
  getTeacherProfileEditingDisabled,
  describePortalSettingsStorage,
  saveTeacherProfileEditingDisabled,
  subscribeToPortalSettings,
} from '../lib/portalSettings';
import { getTeacherProgress, syncTrainingDerivedData } from '../lib/training';
import { parseAssessmentImportFile } from '../lib/submissionImport';
import ConfirmDialog from './ConfirmDialog';
import DataTable, { DataTableColumn } from './DataTable';
import Notification, { NotificationType } from './Notification';

type MaterialFormState = Partial<LearningMaterial> & {
  assignedTo: string[];
  assignedStates: string[];
};

type GradeDraftState = Record<string, { score: string; feedback: string }>;

type GradeEditState = {
  id: string;
  score: string;
  feedback: string;
  contentUrl: string;
};

type ImportPreviewStatus = 'ready' | 'missingTeacher' | 'invalidScore' | 'invalidWeek';

type ImportPreviewRow = ImportedScoreRow & {
  rowNumber: number;
  teacherName?: string;
  teacherId?: string;
  materialTitle?: string;
  materialId?: string;
  status: ImportPreviewStatus;
  reason?: string;
};

type GradingRecordType = 'all' | 'assignment' | 'assessment';

type GradingLibraryFilters = {
  week: string;
  state: string;
  type: GradingRecordType;
};

const defaultMaterialState: MaterialFormState = {
  type: 'slide',
  week: 1,
  assignedTo: ['all'],
  assignedStates: ['all'],
};

function getMaterialFormState(material: LearningMaterial): MaterialFormState {
  return {
    ...material,
    assignedTo: material.assignedTo?.length ? material.assignedTo : ['all'],
    assignedStates: material.assignedStates?.length ? material.assignedStates : ['all'],
  };
}

const defaultNewUser: Partial<UserProfile> = {
  role: 'teacher',
  state: 'Lagos State',
  approvedForCertificate: false,
  totalScore: 0,
  attendance: {},
  assignmentCompletion: {},
  phone: '',
};

const growthLevelLabels: Record<GrowthRole, string> = {
  teacher: 'Teacher',
  trainer: 'Trainer',
  'senior-trainer': 'Senior Trainer',
  'master-trainer': 'Master Trainer',
};

const nextGrowthRole: Partial<Record<UserRole, UserRole>> = {
  teacher: 'trainer',
  trainer: 'senior-trainer',
  'senior-trainer': 'master-trainer',
};

function getRoleLabel(role: UserRole) {
  if (role === 'super-admin') {
    return 'Super Admin';
  }

  if (role === 'admin') {
    return 'Admin';
  }

  return growthLevelLabels[role];
}

function canPromoteRole(role: UserRole) {
  return role === 'teacher' || role === 'trainer' || role === 'senior-trainer';
}

function isGrowthRole(role: UserRole): role is GrowthRole {
  return certificateLevelOrder.includes(role as GrowthRole);
}

function getMigratedRankRole(role: string): UserRole | null {
  if (role === 'pro-trainer') {
    return 'master-trainer';
  }

  if (role === 'master-trainer') {
    return 'senior-trainer';
  }

  return null;
}

function getMigratedCertifications(user: UserProfile) {
  const existing = (user.certifications || {}) as Record<string, unknown>;
  const migrated: Record<string, unknown> = {};

  Object.entries(existing).forEach(([level, approval]) => {
    if (level === 'pro-trainer') {
      migrated['master-trainer'] = migrated['master-trainer'] || approval;
      return;
    }

    if (level === 'master-trainer') {
      migrated['senior-trainer'] = migrated['senior-trainer'] || approval;
      return;
    }

    migrated[level] = approval;
  });

  return migrated;
}

function getSubmissionLabel(submission: AssignmentSubmission, materials: LearningMaterial[]) {
  const material = materials.find((item) => item.id === submission.materialId);
  if (material) {
    return material.title;
  }

  const weeklyTestScoreMatch = submission.materialId.match(/^test-assessment-week-(\d+)$/);
  if (weeklyTestScoreMatch) {
    return `Week ${weeklyTestScoreMatch[1]} Test Score`;
  }

  return 'Unknown Submission';
}

function getSubmissionWeek(submission: AssignmentSubmission, materials: LearningMaterial[]) {
  const material = materials.find((item) => item.id === submission.materialId);
  if (material?.week) {
    return material.week;
  }

  const weeklyTestScoreMatch = submission.materialId.match(/^test-assessment-week-(\d+)$/);
  if (weeklyTestScoreMatch) {
    return Number.parseInt(weeklyTestScoreMatch[1], 10);
  }

  return undefined;
}

function getSubmissionType(submission: AssignmentSubmission, materials: LearningMaterial[]): Exclude<GradingRecordType, 'all'> {
  const material = materials.find((item) => item.id === submission.materialId);
  return material?.type === 'assignment' ? 'assignment' : 'assessment';
}

function isDownloadableSubmissionUrl(url: string | undefined) {
  return !!url && /^https?:\/\//i.test(url);
}

export default function SuperAdminDashboard({
  allowClearAllRecords = true,
  currentUser,
}: {
  allowClearAllRecords?: boolean;
  currentUser?: UserProfile;
}) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [portalSettings, setPortalSettings] = useState<PortalSettings>({ teacherProfileEditingDisabled: false });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'materials' | 'grading' | 'promotion'>('users');
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState<UserProfile | null>(null);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<LearningMaterial | null>(null);
  const [expandedMaterialWeeks, setExpandedMaterialWeeks] = useState<Set<number>>(new Set(WEEKS));
  const [newMaterial, setNewMaterial] = useState<MaterialFormState>(defaultMaterialState);
  const [newUser, setNewUser] = useState<Partial<UserProfile>>(defaultNewUser);
  const [gradeDrafts, setGradeDrafts] = useState<GradeDraftState>({});
  const [promotionSearchTerm, setPromotionSearchTerm] = useState('');
  const [selectedPromotionIds, setSelectedPromotionIds] = useState<Set<string>>(new Set());
  const [promotingUserIds, setPromotingUserIds] = useState<Set<string>>(new Set());
  const [editingGrade, setEditingGrade] = useState<GradeEditState | null>(null);
  const [gradeImporting, setGradeImporting] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importPreviewFileName, setImportPreviewFileName] = useState<string | null>(null);
  const [manualGradeForm, setManualGradeForm] = useState({
    state: '',
    teacherId: '',
    week: '',
    score: '',
  });
  const [gradingLibraryFilters, setGradingLibraryFilters] = useState<GradingLibraryFilters>({
    week: '',
    state: '',
    type: 'all',
  });
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [rankRoleMigrationChecked, setRankRoleMigrationChecked] = useState(false);
  const canApproveCertificates = currentUser?.role === 'super-admin' || currentUser?.role === 'admin';

  useEffect(() => {
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setUsers(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() })) as UserProfile[]);
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users'),
    );

    const unsubMaterials = onSnapshot(
      collection(db, 'materials'),
      (snapshot) => {
        setMaterials(
          snapshot.docs.map((item) => ({ ...(item.data() as LearningMaterial), firestoreId: item.id })) as LearningMaterial[],
        );
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'materials'),
    );

    const unsubSubmissions = onSnapshot(
      collection(db, 'submissions'),
      (snapshot) => {
        setSubmissions(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as AssignmentSubmission[]);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'submissions'),
    );

    const unsubPortalStats = subscribeToPortalSettings(
      db,
      setPortalSettings,
      (error) => {
        console.error('Failed to read portal settings:', error);
        setNotification({
          message: 'Could not read portal settings. Please deploy the latest Firestore rules.',
          type: 'error',
        });
      },
    );

    return () => {
      unsubUsers();
      unsubMaterials();
      unsubSubmissions();
      unsubPortalStats();
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    syncTrainingDerivedData(db, users, materials, submissions).catch((error) => {
      console.error('Failed to sync derived training data:', error);
    });
  }, [loading, users, materials, submissions]);

  useEffect(() => {
    if (
      loading ||
      rankRoleMigrationChecked ||
      portalSettings.rankRoleMigrationCompletedAt ||
      !currentUser ||
      (currentUser.role !== 'super-admin' && currentUser.role !== 'admin')
    ) {
      if (portalSettings.rankRoleMigrationCompletedAt && !rankRoleMigrationChecked) {
        setRankRoleMigrationChecked(true);
      }
      return;
    }

    const legacyRankUsers = users
      .map((user) => ({ user, nextRole: getMigratedRankRole(user.role as string) }))
      .filter((entry): entry is { user: UserProfile; nextRole: UserRole } => !!entry.nextRole);

    const runMigration = async () => {
      const batch = writeBatch(db);

      legacyRankUsers.forEach(({ user, nextRole }) => {
        batch.update(doc(db, 'users', user.uid), {
          role: nextRole,
          certifications: getMigratedCertifications(user),
        });
      });

      batch.set(
        doc(db, 'stats', 'global'),
        {
          rankRoleMigrationCompletedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      await batch.commit();
      setRankRoleMigrationChecked(true);

      if (legacyRankUsers.length > 0) {
        setNotification({
          message: `Updated ${legacyRankUsers.length} legacy rank record${legacyRankUsers.length === 1 ? '' : 's'} to the new growth path.`,
          type: 'success',
        });
      }
    };

    runMigration().catch((error) => {
      console.error('Failed to migrate rank roles:', error);
      setNotification({
        message: 'Rank role migration failed. Please confirm the latest Firestore rules are deployed.',
        type: 'error',
      });
    });
  }, [
    currentUser,
    loading,
    portalSettings.rankRoleMigrationCompletedAt,
    rankRoleMigrationChecked,
    users,
  ]);

  useEffect(() => {
    const candidateIds = new Set(users.filter((user) => canPromoteRole(user.role)).map((user) => user.uid));
    setSelectedPromotionIds((current) => new Set([...current].filter((userId) => candidateIds.has(userId))));
  }, [users]);

  const teacherProgressMap = useMemo(() => {
    return new Map(
      users
        .filter((user) => ['teacher', 'trainer', 'senior-trainer', 'master-trainer'].includes(user.role))
        .map((teacher) => [teacher.uid, getTeacherProgress(teacher, materials, submissions)]),
    );
  }, [users, materials, submissions]);

  const filteredUsers = users.filter((user) => {
    const searchValue = searchTerm.toLowerCase();
    return (
      user.name.toLowerCase().includes(searchValue) ||
      user.email.toLowerCase().includes(searchValue) ||
      (user.phone || '').includes(searchTerm)
    );
  });

  const pendingSubmissions = submissions
    .filter((submission) => submission.status === 'pending')
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
  const gradedSubmissions = submissions
    .filter((submission) => submission.status === 'graded')
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));

  const teacherCount = users.filter((user) => user.role === 'teacher').length;
  const adminCount = users.filter((user) => user.role === 'admin').length;
  const trainerCount = users.filter((user) => user.role === 'trainer').length;
  const seniorTrainerCount = users.filter((user) => user.role === 'senior-trainer').length;
  const masterTrainerCount = users.filter((user) => user.role === 'master-trainer').length;
  const promotionCandidates = users
    .filter((user) => canPromoteRole(user.role))
    .filter((user) => {
      const searchValue = promotionSearchTerm.toLowerCase();
      return (
        user.name.toLowerCase().includes(searchValue) ||
        user.email.toLowerCase().includes(searchValue) ||
        user.state.toLowerCase().includes(searchValue) ||
        getRoleLabel(user.role).toLowerCase().includes(searchValue) ||
        (user.phone || '').includes(promotionSearchTerm)
      );
    });
  const isTeacherProfileEditingDisabled = getTeacherProfileEditingDisabled(portalSettings);
  const materialWeekGroups = useMemo(() => {
    const groups = new Map<number, LearningMaterial[]>();

    sortMaterialsByNewest(materials).forEach((material) => {
      const weekMaterials = groups.get(material.week) || [];
      weekMaterials.push(material);
      groups.set(material.week, weekMaterials);
    });

    return Array.from(groups.entries())
      .map(([week, weekMaterials]) => ({
        week,
        materials: weekMaterials,
        latestUploadTime: Math.max(...weekMaterials.map(getMaterialCreatedAtTime)),
      }))
      .sort((a, b) => b.latestUploadTime - a.latestUploadTime || b.week - a.week);
  }, [materials]);

  const toggleMaterialWeekExpanded = (week: number) => {
    setExpandedMaterialWeeks((current) => {
      const next = new Set(current);

      if (next.has(week)) {
        next.delete(week);
      } else {
        next.add(week);
      }

      return next;
    });
  };

  const userColumns: DataTableColumn<UserProfile>[] = [
    {
      key: 'user',
      header: 'User',
      sortable: true,
      sortValue: (user) => user.name,
      render: (user) => (
        <div className="flex items-center space-x-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm ${
              user.role === 'super-admin'
                ? 'bg-indigo-100 text-indigo-700'
                : user.role === 'admin'
                  ? 'bg-emerald-100 text-emerald-700'
                  : user.role === 'trainer'
                    ? 'bg-amber-100 text-amber-700'
                    : user.role === 'senior-trainer'
                      ? 'bg-violet-100 text-violet-700'
                      : user.role === 'master-trainer'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-blue-100 text-blue-700'
            }`}
          >
            {user.name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-gray-900 leading-none mb-1">{user.name}</p>
            <p className="text-[10px] font-mono text-gray-400 tracking-wider">UID: {user.uid.slice(0, 8)}...</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      sortValue: (user) => user.role,
      render: (user) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold capitalize ${
            user.role === 'super-admin'
              ? 'bg-indigo-50 text-indigo-700'
              : user.role === 'admin'
                ? 'bg-emerald-50 text-emerald-700'
                : user.role === 'trainer'
                  ? 'bg-amber-50 text-amber-700'
                  : user.role === 'senior-trainer'
                    ? 'bg-violet-50 text-violet-700'
                    : user.role === 'master-trainer'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-blue-50 text-blue-700'
          }`}
        >
          <Shield size={12} className="mr-1" />
          {getRoleLabel(user.role)}
        </span>
      ),
    },
    {
      key: 'state',
      header: 'State',
      sortable: true,
      sortValue: (user) => user.state,
      render: (user) => (
        <div className="flex items-center text-sm text-gray-600">
          <MapPin size={14} className="mr-1.5 text-gray-400" />
          {user.state}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      sortable: true,
      sortValue: (user) => user.email,
      render: (user) => (
        <div className="space-y-1.5">
          <div className="flex items-center text-xs font-medium text-gray-600">
            <Mail size={13} className="mr-1.5 text-gray-400" />
            {user.email || 'N/A'}
          </div>
          <div className="flex items-center text-xs font-medium text-gray-600">
            <Phone size={13} className="mr-1.5 text-gray-400" />
            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{user.phone || 'N/A'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      sortable: true,
      sortValue: (user) => (teacherProgressMap.get(user.uid)?.totalScore ?? -1),
      render: (user) => {
        const progress = teacherProgressMap.get(user.uid);
        return (
          <span className="text-sm text-gray-600">
            {progress
              ? `${progress.totalScore} pts / ${progress.completedWeeklyTests} tests / ${progress.attendanceCount} attendance weeks`
              : 'N/A'}
          </span>
        );
      },
    },
    {
      key: 'certificate',
      header: 'Certifications',
      sortable: true,
      sortValue: (user) =>
        isGrowthRole(user.role)
          ? getCertificateLevelsForUser(user).filter((level) => isCertificationApproved(user, level)).length
          : -1,
      render: (user) => {
        if (!isGrowthRole(user.role)) {
          return <span className="text-xs text-gray-400">N/A</span>;
        }

        return (
          <div className="flex flex-wrap gap-2">
            {getCertificateLevelsForUser(user).map((level) => {
              const approved = isCertificationApproved(user, level);

              return (
                <button
                  key={level}
                  type="button"
                  disabled={!canApproveCertificates}
                  onClick={() => handleApproveCertificate(user, level, !approved)}
                  className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    approved
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } ${canApproveCertificates ? '' : 'cursor-not-allowed opacity-75'}`}
                  title={canApproveCertificates ? undefined : 'Only Admins can approve certificates'}
                >
                  {certificateLevelLabels[level]}: {approved ? 'Approved' : 'Approve'}
                </button>
              );
            })}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (user) => (
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={() => setShowEditUser(user)}
            className="p-2 text-gray-400 hover:text-dltt-green hover:bg-green-50 rounded-lg transition-all"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={() => handleDeleteUser(user)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];

  const promotionColumns: DataTableColumn<UserProfile>[] = [
    {
      key: 'select',
      header: 'Select',
      headerClassName: 'w-24',
      render: (teacher) => (
        <input
          type="checkbox"
          aria-label={`Select ${teacher.name}`}
          checked={selectedPromotionIds.has(teacher.uid)}
          onChange={(e) =>
            setSelectedPromotionIds((current) => {
              const next = new Set(current);
              if (e.target.checked) {
                next.add(teacher.uid);
              } else {
                next.delete(teacher.uid);
              }
              return next;
            })
          }
          className="h-4 w-4 rounded border-gray-300 text-dltt-green focus:ring-dltt-green"
        />
      ),
    },
    {
      key: 'user',
      header: 'User',
      sortable: true,
      sortValue: (selectedUser) => selectedUser.name,
      render: (selectedUser) => (
        <div>
          <p className="font-bold text-gray-900">{selectedUser.name}</p>
          <p className="text-xs text-gray-500">{selectedUser.email || 'No email'}</p>
        </div>
      ),
    },
    {
      key: 'level',
      header: 'Level',
      sortable: true,
      sortValue: (selectedUser) => getRoleLabel(selectedUser.role),
      render: (selectedUser) => (
        <span className="inline-flex items-center rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
          {getRoleLabel(selectedUser.role)}
        </span>
      ),
    },
    {
      key: 'nextLevel',
      header: 'Next Level',
      sortable: true,
      sortValue: (selectedUser) => getRoleLabel(nextGrowthRole[selectedUser.role] || selectedUser.role),
      render: (selectedUser) => {
        const nextRole = nextGrowthRole[selectedUser.role];
        return <span className="text-sm font-semibold text-dltt-green">{nextRole ? getRoleLabel(nextRole) : 'Top Level'}</span>;
      },
    },
    {
      key: 'state',
      header: 'State',
      sortable: true,
      sortValue: (teacher) => teacher.state,
      render: (teacher) => (
        <div className="flex items-center text-sm text-gray-600">
          <MapPin size={14} className="mr-1.5 text-gray-400" />
          {teacher.state}
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      sortable: true,
      sortValue: (selectedUser) => teacherProgressMap.get(selectedUser.uid)?.totalScore ?? 0,
      render: (selectedUser) => {
        const progress = teacherProgressMap.get(selectedUser.uid);
        return (
          <span className="text-sm text-gray-600">
            {progress
              ? `${progress.totalScore} pts / ${progress.completedWeeklyTests} tests / ${progress.attendanceCount} attendance weeks`
              : 'No activity yet'}
          </span>
        );
      },
    },
    {
      key: 'trainer',
      header: 'Current Trainer',
      sortable: true,
      sortValue: (selectedUser) => selectedUser.trainerId || '',
      render: (selectedUser) => {
        const trainer = users.find((user) => user.uid === selectedUser.trainerId);
        return <span className="text-sm text-gray-600">{trainer?.name || 'Unassigned'}</span>;
      },
    },
    {
      key: 'action',
      header: 'Promote',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (selectedUser) => {
        const isPromoting = promotingUserIds.has(selectedUser.uid);

        return (
          <button
            type="button"
            onClick={() => handlePromoteUser(selectedUser)}
            disabled={isPromoting}
            className="inline-flex min-w-24 items-center justify-center rounded-lg bg-dltt-green px-3 py-2 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isPromoting ? 'Promoting...' : 'Promote'}
          </button>
        );
      },
    },
  ];

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.phone) {
      setNotification({ message: 'Email and phone are required.', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newUser.email.trim(), newUser.phone);
      const uid = userCredential.user.uid;
      await setDoc(doc(db, 'users', uid), {
        ...defaultNewUser,
        ...newUser,
        uid,
        name: newUser.name || 'New User',
        email: newUser.email.trim().toLowerCase(),
      });
      setShowAddUser(false);
      setNewUser(defaultNewUser);
      setNotification({ message: 'User created successfully. Phone number is the initial password.', type: 'success' });
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        setNotification({ message: 'This email is already registered.', type: 'error' });
      } else {
        handleFirestoreError(error, OperationType.CREATE, 'users');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTeachers = () => {
    const teachers = users.filter((user) => user.role === 'teacher');
    const data = teachers.map((teacher) => ({
      'Full Name': teacher.name,
      State: teacher.state,
      Gender: teacher.gender || '',
      Email: teacher.email,
      'Phone Number': teacher.phone,
      'Account Number': teacher.accountNumber || '',
      'Account Name': teacher.accountName || '',
      'Bank Name': teacher.bank || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Teachers');
    XLSX.writeFile(workbook, 'teachers-data.xlsx');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditUser) {
      return;
    }

    try {
        await updateDoc(doc(db, 'users', showEditUser.uid), {
          name: showEditUser.name,
          email: showEditUser.email,
          phone: showEditUser.phone,
          role: showEditUser.role,
          state: showEditUser.state,
          school: showEditUser.school || '',
          gender: showEditUser.gender || null,
          approvedForCertificate: !!showEditUser.approvedForCertificate,
          attendance: showEditUser.attendance || {},
          accountNumber: showEditUser.accountNumber || '',
          bank: showEditUser.bank || '',
        accountName: showEditUser.accountName || '',
      });
      setShowEditUser(null);
      setNotification({ message: 'User updated successfully.', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleApproveCertificate = async (targetUser: UserProfile, level: GrowthRole, approved: boolean) => {
    if (!canApproveCertificates || !currentUser) {
      setNotification({ message: 'Only Admins can approve certificates.', type: 'error' });
      return;
    }

    const certifications = {
      ...(targetUser.certifications || {}),
      [level]: approved
        ? {
            approved: true,
            approvedAt: new Date().toISOString(),
            approvedBy: currentUser.uid,
          }
        : {
            approved: false,
          },
    };

    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        certifications,
        ...(level === 'teacher' ? { approvedForCertificate: approved } : {}),
      });
      setNotification({
        message: approved
          ? `${certificateLevelLabels[level]} certificate approved.`
          : `${certificateLevelLabels[level]} certificate approval removed.`,
        type: 'success',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const promoteUsersToNextLevel = async (userIds: string[]) => {
    const promotableUsers = users.filter((user) => userIds.includes(user.uid) && canPromoteRole(user.role));

    if (promotableUsers.length === 0) {
      setNotification({ message: 'Select at least one eligible user to promote.', type: 'error' });
      return;
    }

    const promotableIds = promotableUsers.map((user) => user.uid);

    try {
      setPromotingUserIds((current) => new Set([...current, ...promotableIds]));
      const promotedAt = new Date().toISOString();
      const batch = writeBatch(db);

      promotableUsers.forEach((selectedUser) => {
        const nextRole = nextGrowthRole[selectedUser.role];
        if (!nextRole) {
          return;
        }

        batch.update(doc(db, 'users', selectedUser.uid), {
          role: nextRole,
          promotedAt,
          trainerId: deleteField(),
        });
      });

      await batch.commit();
      setSelectedPromotionIds(new Set());
      setNotification({
        message: `${promotableUsers.length} user${promotableUsers.length === 1 ? '' : 's'} promoted to the next level.`,
        type: 'success',
      });
    } catch (error) {
      console.error('Promotion failed:', error);
      setNotification({
        message: 'Promotion failed. Please check that the latest Firestore rules are deployed, then try again.',
        type: 'error',
      });
    } finally {
      setPromotingUserIds((current) => {
        const next = new Set(current);
        promotableIds.forEach((userId) => next.delete(userId));
        return next;
      });
    }
  };

  const handlePromoteUser = async (selectedUser: UserProfile) => {
    const nextRole = nextGrowthRole[selectedUser.role];
    if (!nextRole) {
      setNotification({ message: `${selectedUser.name} is already at the highest growth level.`, type: 'error' });
      return;
    }

    await promoteUsersToNextLevel([selectedUser.uid]);
  };

  const handleBulkPromoteUsers = () => {
    const userIds = [...selectedPromotionIds];
    if (userIds.length === 0) {
      setNotification({ message: 'Select at least one eligible user to promote.', type: 'error' });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Promote Selected Users',
      message: `Promote ${userIds.length} selected user${userIds.length === 1 ? '' : 's'} to their next growth level?`,
      onConfirm: () => promoteUsersToNextLevel(userIds),
    });
  };

  const handleTeacherProfileEditingToggle = async (disabled: boolean) => {
    const previousSettings = portalSettings;
    setPortalSettings({ teacherProfileEditingDisabled: disabled });

    try {
      await saveTeacherProfileEditingDisabled(db, auth, disabled);
      setNotification({
        message: disabled ? 'Teacher profile editing has been disabled.' : 'Teacher profile editing has been enabled.',
        type: 'success',
      });
    } catch (error) {
      setPortalSettings(previousSettings);
      console.error('Failed to update teacher profile editing setting:', error);
      setNotification({
        message: 'Could not update teacher profile editing. Please check your Firebase permissions and try again.',
        type: 'error',
      });
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setLoading(true);
        const workbook = XLSX.read(event.target?.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

        if (rows.length === 0) {
          setNotification({ message: 'The Excel file is empty.', type: 'error' });
          return;
        }

        const seenEmails = new Set<string>();
        let successCount = 0;
        let failCount = 0;
        let duplicateCount = 0;

        for (const row of rows) {
          const email = String(row.Email || row.email || row.EMAIL || row['Email Address'] || '').trim().toLowerCase();
          const phone = String(row.Phone || row.phone || row.PHONE || row['Phone Number'] || '').trim();
          const name = String(row.Name || row.name || row.NAME || row['Full Name'] || '').trim();
          const role = String(row.Role || row.role || row.ROLE || 'teacher').trim().toLowerCase() as UserRole;
          const state = String(row.State || row.state || row.STATE || 'Lagos State').trim();

          if (!email || !phone) {
            failCount++;
            continue;
          }

          if (seenEmails.has(email)) {
            duplicateCount++;
            failCount++;
            continue;
          }

          seenEmails.add(email);

          try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, phone);
            const uid = userCredential.user.uid;
            await setDoc(doc(db, 'users', uid), {
              uid,
              name: name || email.split('@')[0],
              email,
              phone,
              role: ['teacher', 'trainer', 'senior-trainer', 'master-trainer', 'admin', 'super-admin'].includes(role) ? role : 'teacher',
              state: STATES.includes(state) ? state : 'Lagos State',
              approvedForCertificate: false,
              totalScore: 0,
              attendance: {},
              assignmentCompletion: {},
            });
            successCount++;
          } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
              duplicateCount++;
            }
            failCount++;
          }
        }

        const duplicateText = duplicateCount > 0 ? ` ${duplicateCount} duplicate email(s) were skipped.` : '';
        setNotification({
          message: `Upload complete. ${successCount} user(s) created, ${failCount} failed.${duplicateText}`,
          type: successCount > 0 ? 'success' : 'error',
        });
      } catch (error) {
        console.error('Excel processing error:', error);
        setNotification({
          message: 'Failed to process Excel file. Please ensure it is a valid .xlsx or .xls file.',
          type: 'error',
        });
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handleOpenAddMaterial = () => {
    setEditingMaterial(null);
    setNewMaterial(defaultMaterialState);
    setShowAddMaterial(true);
  };

  const handleOpenEditMaterial = (material: LearningMaterial) => {
    setEditingMaterial(material);
    setNewMaterial(getMaterialFormState(material));
    setShowAddMaterial(true);
  };

  const handleCloseMaterialForm = () => {
    setShowAddMaterial(false);
    setEditingMaterial(null);
    setNewMaterial(defaultMaterialState);
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const assignedTo = newMaterial.assignedTo.length > 0 ? newMaterial.assignedTo : ['all'];
      const assignedStates = newMaterial.assignedStates.length > 0 ? newMaterial.assignedStates : ['all'];

      if (editingMaterial) {
        await updateDoc(doc(db, 'materials', editingMaterial.firestoreId || editingMaterial.id), {
          title: newMaterial.title || '',
          description: newMaterial.description || '',
          type: newMaterial.type || 'slide',
          contentUrl: newMaterial.contentUrl || '',
          week: newMaterial.week || 1,
          assignedTo,
          assignedStates,
          dueDate: newMaterial.type === 'assignment' ? newMaterial.dueDate || '' : deleteField(),
        });
        setNotification({ message: 'Material updated successfully.', type: 'success' });
      } else {
        const materialRef = doc(collection(db, 'materials'));
        const materialData = {
          id: materialRef.id,
          title: newMaterial.title || '',
          description: newMaterial.description || '',
          type: newMaterial.type || 'slide',
          contentUrl: newMaterial.contentUrl || '',
          week: newMaterial.week || 1,
          createdAt: new Date().toISOString(),
          assignedTo,
          assignedStates,
          ...(newMaterial.type === 'assignment' ? { dueDate: newMaterial.dueDate || '' } : {}),
        } as LearningMaterial;

        await setDoc(materialRef, materialData);
        setNotification({ message: 'Material added successfully.', type: 'success' });
      }

      handleCloseMaterialForm();
    } catch (error) {
      handleFirestoreError(error, editingMaterial ? OperationType.UPDATE : OperationType.CREATE, 'materials');
    }
  };

  const handleImportGrades = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setGradeImporting(true);
      const rows = await parseAssessmentImportFile(file);
      const previewRows = rows.map((row, index) => {
        const normalizedEmail = row.teacherEmail.trim().toLowerCase();
        const teacher = users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail);

        const weekInvalid = typeof row.week !== 'number' || Number.isNaN(row.week) || !WEEKS.includes(row.week);
        const assessmentId = !weekInvalid ? `test-assessment-week-${row.week}` : undefined;
        const scoreInvalid = Number.isNaN(row.score) || row.score < 0 || row.score > 100;
        let status: ImportPreviewStatus = 'ready';
        let reason = undefined;

        if (scoreInvalid) {
          status = 'invalidScore';
          reason = 'Score must be a number between 0 and 100';
        } else if (weekInvalid) {
          status = 'invalidWeek';
          reason = `Week must be one of: ${WEEKS.join(', ')}`;
        } else if (!teacher) {
          status = 'missingTeacher';
          reason = 'Teacher not found for this email';
        }

        return {
          ...row,
          rowNumber: index + 1,
          teacherName: teacher?.name,
          teacherId: teacher?.uid,
          materialTitle: assessmentId ? `Week ${row.week} test score` : undefined,
          materialId: assessmentId,
          status,
          reason,
        };
      });

      setImportPreviewRows(previewRows);
      setImportPreviewFileName(file.name);
      setNotification({ message: `Preview loaded: ${previewRows.length} rows. Confirm to finish upload.`, type: 'success' });
    } catch (error) {
      console.error('Grade import failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setNotification({
        message: `Could not parse grades. Error: ${errorMsg}. Please check the file format and try again.`,
        type: 'error',
      });
    } finally {
      setGradeImporting(false);
      e.target.value = '';
    }
  };

  const handleCancelImportPreview = () => {
    setImportPreviewRows([]);
    setImportPreviewFileName(null);
  };

  const handleConfirmImportGrades = async () => {
    const readyRows = importPreviewRows.filter((row) => row.status === 'ready');
    if (readyRows.length === 0) {
      setNotification({ message: 'No valid rows are ready to upload.', type: 'error' });
      return;
    }

    try {
      setGradeImporting(true);
      let created = 0;
      let updated = 0;

      for (const row of readyRows) {
        const teacher = users.find(
          (user) => user.email?.trim().toLowerCase() === row.teacherEmail.trim().toLowerCase(),
        );
        if (!teacher) {
          continue;
        }

        if (typeof row.week !== 'number' || Number.isNaN(row.week)) {
          continue;
        }

        const submissionMaterialId = `test-assessment-week-${row.week}`;
        const existingSubmission = submissions.find(
          (submission) => submission.teacherId === teacher.uid && submission.materialId === submissionMaterialId,
        );
        const contentUrl = row.contentUrl?.trim() || 'Imported weekly test score';
        const submittedAt = row.submittedAt || new Date().toISOString();
        const submissionData = {
          teacherId: teacher.uid,
          materialId: submissionMaterialId,
          contentUrl,
          submittedAt,
          score: row.score,
          feedback: row.feedback || '',
          status: 'graded' as const,
        };

        if (existingSubmission) {
          await updateDoc(doc(db, 'submissions', existingSubmission.id), submissionData);
          updated += 1;
        } else {
          const submissionRef = doc(collection(db, 'submissions'));
          await setDoc(submissionRef, { id: submissionRef.id, ...submissionData });
          created += 1;
        }
      }

      setNotification({
        message: `Import complete. ${created} created, ${updated} updated.`,
        type: created + updated > 0 ? 'success' : 'error',
      });
      setImportPreviewRows([]);
      setImportPreviewFileName(null);
    } catch (error) {
      console.error('Grade import confirmation failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setNotification({
        message: `Could not confirm grade import. Error: ${errorMsg}.`,
        type: 'error',
      });
    } finally {
      setGradeImporting(false);
    }
  };

  const handleDownloadScoreTemplate = () => {
    const headers = ['Email', 'Score', 'Week'];
    const sampleRow = ['teacher@example.com', '85', '3'];
    const csv = `${headers.join(',')}\n${sampleRow.join(',')}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'assessment-score-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubmitManualGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const { teacherId, week, score } = manualGradeForm;

    if (!teacherId || !week || !score) {
      setNotification({ message: 'Please fill in all required fields.', type: 'error' });
      return;
    }

    const weekNum = Number.parseInt(week, 10);
    const scoreNum = Number.parseInt(score, 10);

    if (Number.isNaN(weekNum) || Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      setNotification({ message: 'Enter a valid week number and score between 0 and 100.', type: 'error' });
      return;
    }

    try {
      const teacher = users.find((t) => t.uid === teacherId);
      const submissionMaterialId = `test-assessment-week-${weekNum}`;

      if (!teacher) {
        setNotification({ message: 'Selected teacher not found.', type: 'error' });
        return;
      }

      const existingSubmission = submissions.find(
        (submission) => submission.teacherId === teacher.uid && submission.materialId === submissionMaterialId,
      );

      const submissionData = {
        teacherId: teacher.uid,
        materialId: submissionMaterialId,
        contentUrl: 'Manual weekly test score',
        submittedAt: new Date().toISOString(),
        score: scoreNum,
        feedback: 'Manually graded by admin',
        status: 'graded' as const,
      };

      if (existingSubmission) {
        await updateDoc(doc(db, 'submissions', existingSubmission.id), submissionData);
        setNotification({ message: 'Grade updated successfully.', type: 'success' });
      } else {
        const submissionRef = doc(collection(db, 'submissions'));
        await setDoc(submissionRef, { id: submissionRef.id, ...submissionData });
        setNotification({ message: 'Grade recorded successfully.', type: 'success' });
      }

      setManualGradeForm({ state: '', teacherId: '', week: '', score: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'submissions');
    }
  };

  const handleDeleteSubmission = (submissionId: string, label = 'this submission record') => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Submission',
      message: `Delete ${label}? This cannot be undone.`,
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'submissions', submissionId));
          setGradeDrafts((current) => {
            const next = { ...current };
            delete next[submissionId];
            return next;
          });
          setNotification({ message: 'Submission deleted successfully.', type: 'success' });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'submissions');
        }
      },
    });
  };

  const openGradeEditor = (submission: AssignmentSubmission) => {
    setEditingGrade({
      id: submission.id,
      score: typeof submission.score === 'number' ? String(submission.score) : '',
      feedback: submission.feedback || '',
      contentUrl: submission.contentUrl || '',
    });
  };

  const handleUpdateGradedSubmission = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingGrade) {
      return;
    }

    const score = Number.parseInt(editingGrade.score, 10);
    const contentUrl = editingGrade.contentUrl.trim();

    if (Number.isNaN(score) || score < 0 || score > 100) {
      setNotification({ message: 'Enter a valid score between 0 and 100.', type: 'error' });
      return;
    }

    if (!contentUrl) {
      setNotification({ message: 'Submitted assignment URL is required.', type: 'error' });
      return;
    }

    try {
      await updateDoc(doc(db, 'submissions', editingGrade.id), {
        score,
        feedback: editingGrade.feedback.trim(),
        contentUrl,
        status: 'graded',
      });
      setEditingGrade(null);
      setNotification({ message: 'Grade updated successfully.', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'submissions');
    }
  };

  const gradingLibrarySubmissions = useMemo(() => {
    return submissions
      .filter((submission) => {
        const teacher = users.find((user) => user.uid === submission.teacherId);
        const week = getSubmissionWeek(submission, materials);
        const recordType = getSubmissionType(submission, materials);

        return (
          (!gradingLibraryFilters.state || teacher?.state === gradingLibraryFilters.state) &&
          (!gradingLibraryFilters.week || String(week || '') === gradingLibraryFilters.week) &&
          (gradingLibraryFilters.type === 'all' || recordType === gradingLibraryFilters.type)
        );
      })
      .sort((a, b) => Date.parse(b.submittedAt || '') - Date.parse(a.submittedAt || ''));
  }, [gradingLibraryFilters, materials, submissions, users]);

  const handleDownloadGradingLibrary = () => {
    if (gradingLibrarySubmissions.length === 0) {
      setNotification({ message: 'There are no filtered records to download.', type: 'error' });
      return;
    }

    const data = gradingLibrarySubmissions.map((submission) => {
      const teacher = users.find((user) => user.uid === submission.teacherId);
      const week = getSubmissionWeek(submission, materials);
      const recordType = getSubmissionType(submission, materials);

      return {
        'Teacher Name': teacher?.name || 'Unknown User',
        Email: teacher?.email || '',
        State: teacher?.state || '',
        Week: week ? `Week ${week}` : '',
        Type: recordType === 'assignment' ? 'Assignment' : 'Assessment',
        Record: getSubmissionLabel(submission, materials),
        Status: submission.status === 'graded' ? 'Graded' : 'Pending',
        Score: typeof submission.score === 'number' ? submission.score : '',
        Feedback: submission.feedback || '',
        'Submitted At': submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '',
        'Submission Link': submission.contentUrl || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 28 },
      { wch: 30 },
      { wch: 18 },
      { wch: 12 },
      { wch: 14 },
      { wch: 34 },
      { wch: 12 },
      { wch: 10 },
      { wch: 36 },
      { wch: 22 },
      { wch: 48 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Filtered Records');

    const weekLabel = gradingLibraryFilters.week ? `week-${gradingLibraryFilters.week}` : 'all-weeks';
    const stateLabel = (gradingLibraryFilters.state || 'all-states').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const typeLabel =
      gradingLibraryFilters.type === 'all' ? 'assignments-assessments' : `${gradingLibraryFilters.type}s`;
    const dateLabel = new Date().toISOString().slice(0, 10);

    XLSX.writeFile(workbook, `dltt-${typeLabel}-${weekLabel}-${stateLabel}-${dateLabel}.xlsx`);
  };

  const gradingLibraryColumns: DataTableColumn<AssignmentSubmission>[] = [
    {
      key: 'teacher',
      header: 'Teacher',
      sortable: true,
      sortValue: (submission) => users.find((user) => user.uid === submission.teacherId)?.name || 'Unknown User',
      render: (submission) => {
        const teacher = users.find((user) => user.uid === submission.teacherId);

        return (
          <div>
            <p className="font-semibold text-gray-900">{teacher?.name || 'Unknown User'}</p>
            <p className="text-xs text-gray-500">{teacher?.email || submission.teacherId}</p>
          </div>
        );
      },
    },
    {
      key: 'state',
      header: 'State',
      sortable: true,
      sortValue: (submission) => users.find((user) => user.uid === submission.teacherId)?.state || '',
      render: (submission) => (
        <span className="text-sm text-gray-700">
          {users.find((user) => user.uid === submission.teacherId)?.state || '-'}
        </span>
      ),
    },
    {
      key: 'week',
      header: 'Week',
      sortable: true,
      sortValue: (submission) => getSubmissionWeek(submission, materials) || 0,
      render: (submission) => {
        const week = getSubmissionWeek(submission, materials);
        return <span className="text-sm font-semibold text-gray-800">{week ? `Week ${week}` : '-'}</span>;
      },
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      sortValue: (submission) => getSubmissionType(submission, materials),
      render: (submission) => {
        const recordType = getSubmissionType(submission, materials);
        return (
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
              recordType === 'assignment' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
            }`}
          >
            {recordType === 'assignment' ? 'Assignment' : 'Assessment'}
          </span>
        );
      },
    },
    {
      key: 'record',
      header: 'Record',
      sortable: true,
      sortValue: (submission) => getSubmissionLabel(submission, materials),
      render: (submission) => <span className="text-sm text-gray-700">{getSubmissionLabel(submission, materials)}</span>,
    },
    {
      key: 'score',
      header: 'Status / Score',
      sortable: true,
      sortValue: (submission) => submission.score ?? -1,
      render: (submission) => (
        <div className="space-y-1">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
              submission.status === 'graded' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
            }`}
          >
            {submission.status === 'graded' ? 'Graded' : 'Pending'}
          </span>
          <p className="text-sm font-bold text-gray-900">
            {typeof submission.score === 'number' ? `${submission.score}/100` : '-'}
          </p>
        </div>
      ),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      sortable: true,
      sortValue: (submission) => Date.parse(submission.submittedAt || '') || 0,
      render: (submission) => (
        <span className="text-sm text-gray-600">
          {submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Submission',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (submission) => {
        const canOpen = isDownloadableSubmissionUrl(submission.contentUrl);

        return (
          <div className="flex items-center justify-end">
            {canOpen ? (
              <a
                href={submission.contentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-dltt-green"
                title="View submission"
                aria-label="View submission"
              >
                <ExternalLink size={18} />
              </a>
            ) : (
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-100 bg-gray-50 text-gray-300">
                <ExternalLink size={18} />
              </span>
            )}
          </div>
        );
      },
    },
  ];

  const gradedSubmissionColumns: DataTableColumn<AssignmentSubmission>[] = [
    {
      key: 'teacher',
      header: 'Teacher',
      sortable: true,
      sortValue: (submission) => users.find((user) => user.uid === submission.teacherId)?.name || 'Unknown User',
      render: (submission) => {
        const teacher = users.find((user) => user.uid === submission.teacherId);

        return (
          <div>
            <p className="font-semibold text-gray-900">{teacher?.name || 'Unknown User'}</p>
            <p className="text-xs text-gray-500">{teacher?.email || submission.teacherId}</p>
          </div>
        );
      },
    },
    {
      key: 'record',
      header: 'Record',
      sortable: true,
      sortValue: (submission) => getSubmissionLabel(submission, materials),
      render: (submission) => <span className="text-sm text-gray-700">{getSubmissionLabel(submission, materials)}</span>,
    },
    {
      key: 'score',
      header: 'Score',
      sortable: true,
      sortValue: (submission) => submission.score ?? -1,
      render: (submission) => (
        <span className="font-bold text-gray-900">
          {typeof submission.score === 'number' ? `${submission.score}/100` : '-'}
        </span>
      ),
    },
    {
      key: 'feedback',
      header: 'Feedback',
      sortable: true,
      sortValue: (submission) => submission.feedback || '',
      className: 'max-w-xs',
      render: (submission) => <p className="truncate text-sm text-gray-600">{submission.feedback || '-'}</p>,
    },
    {
      key: 'submissionUrl',
      header: 'Submitted Assignment',
      sortable: true,
      sortValue: (submission) => submission.contentUrl || '',
      className: 'max-w-xs',
      render: (submission) =>
        submission.contentUrl ? (
          <a
            href={submission.contentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-bold text-dltt-green hover:underline"
            title={submission.contentUrl}
          >
            {submission.contentUrl}
          </a>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        ),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      sortable: true,
      sortValue: (submission) => Date.parse(submission.submittedAt || '') || 0,
      render: (submission) => (
        <span className="text-sm text-gray-600">
          {submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (submission) => {
        const teacher = users.find((user) => user.uid === submission.teacherId);
        const submissionLabel = getSubmissionLabel(submission, materials);
        const deleteLabel = `${submissionLabel} for ${teacher?.name || 'Unknown User'}`;

        return (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              aria-label="Edit grade"
              title="Edit grade"
              onClick={() => openGradeEditor(submission)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-dltt-green"
            >
              <Edit size={18} />
            </button>
            <button
              type="button"
              aria-label="Delete submission"
              title="Delete submission"
              onClick={() => handleDeleteSubmission(submission.id, deleteLabel)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            >
              <Trash2 size={18} />
            </button>
          </div>
        );
      },
    },
  ];
  
  const handleGradeSubmission = async (submissionId: string) => {
    const draft = gradeDrafts[submissionId];
    const score = Number.parseInt(draft?.score || '', 10);
    const feedback = draft?.feedback?.trim() || '';

    if (Number.isNaN(score) || score < 0 || score > 100) {
      setNotification({ message: 'Enter a valid score between 0 and 100.', type: 'error' });
      return;
    }

    try {
      await updateDoc(doc(db, 'submissions', submissionId), {
        score,
        feedback,
        status: 'graded',
      });
      setGradeDrafts((current) => {
        const next = { ...current };
        delete next[submissionId];
        return next;
      });
      setNotification({ message: 'Grade submitted.', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'submissions');
    }
  };

  const handleDeleteMaterial = (material: LearningMaterial) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Material',
      message: `Delete "${material.title}"? This cannot be undone. All related submissions will also be deleted.`,
      isDanger: true,
      onConfirm: async () => {
        try {
          const submissionsQuery = query(collection(db, 'submissions'), where('materialId', '==', material.id));
          const submissionsSnapshot = await getDocs(submissionsQuery);
          const batch = writeBatch(db);

          batch.delete(doc(db, 'materials', material.firestoreId || material.id));
          submissionsSnapshot.forEach((submissionDoc) => {
            batch.delete(doc(db, 'submissions', submissionDoc.id));
          });

          await batch.commit();
          setNotification({ message: 'Material and related submissions deleted successfully.', type: 'success' });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'materials');
        }
      },
    });
  };

  const handleDeleteUser = (user: UserProfile) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete User',
      message: `Delete ${user.name}'s Firestore profile? Their Firebase Authentication account will still exist.`,
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', user.uid));
          setNotification({ message: 'User profile deleted.', type: 'success' });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'users');
        }
      },
    });
  };

  const handleClearAllUsers = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Clear All Users',
      message:
        'This removes every user profile from Firestore. Authentication accounts will remain in Firebase Authentication and must be removed separately.',
      isDanger: true,
      onConfirm: async () => {
        try {
          setLoading(true);
          await Promise.all(users.map((user) => deleteDoc(doc(db, 'users', user.uid))));
          setNotification({ message: 'All Firestore user records cleared.', type: 'success' });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'users');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const toggleAssignedState = (state: string) => {
    const current = newMaterial.assignedStates || [];
    setNewMaterial({
      ...newMaterial,
      assignedStates: current.includes(state) ? current.filter((item) => item !== state) : [...current, state],
    });
  };

  const toggleAssignedUser = (userId: string) => {
    const current = newMaterial.assignedTo || [];
    setNewMaterial({
      ...newMaterial,
      assignedTo: current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId],
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dltt-green"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
          <p className="text-gray-600">Full control over users, roles, learning materials, and grading.</p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 items-end">
          <div className="text-right">
            <p className="text-[10px] text-gray-400 mb-1 font-medium">Required columns: Email, Phone</p>
            <label className="bg-white text-gray-700 px-6 py-2 rounded-lg font-bold flex items-center space-x-2 hover:bg-gray-50 transition-colors border border-gray-200 cursor-pointer shadow-sm">
              <FileSpreadsheet size={20} className="text-emerald-600" />
              <span>Upload Excel</span>
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleExcelUpload} />
            </label>
          </div>
          <button
            onClick={() => setShowAddUser(true)}
            className="bg-dltt-green text-white px-6 py-2 rounded-lg font-bold flex items-center space-x-2 hover:opacity-90 transition-opacity shadow-sm"
          >
            <UserPlus size={20} />
            <span>Create User</span>
          </button>
        </div>
      </div>

      <div className="flex space-x-4 mb-8 border-b border-gray-200 overflow-x-auto">
        {[
          { id: 'users', label: 'User Management', icon: Users },
          { id: 'materials', label: 'Materials', icon: FileText },
          { id: 'grading', label: 'Grading', icon: CheckCircle },
          { id: 'promotion', label: 'Promotion', icon: Shield },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center space-x-2 px-4 py-2 border-b-2 font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-dltt-green text-dltt-green'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">{users.length}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Admins</p>
              <p className="text-3xl font-bold text-dltt-green">{adminCount}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Teachers</p>
              <p className="text-3xl font-bold text-blue-600">{teacherCount}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Trainers</p>
              <p className="text-3xl font-bold text-amber-600">{trainerCount}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Senior Trainers</p>
              <p className="text-3xl font-bold text-violet-600">{seniorTrainerCount}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Master Trainers</p>
              <p className="text-3xl font-bold text-rose-600">{masterTrainerCount}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/30">
              <h2 className="text-xl font-bold text-gray-900">User Management</h2>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleDownloadTeachers}
                  className="flex items-center space-x-2 px-4 py-2 bg-dltt-green text-white rounded-xl font-bold hover:opacity-90 transition-opacity"
                >
                  <FileSpreadsheet size={18} />
                  <span>Download Teachers</span>
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by name, email or phone..."
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm w-full sm:w-80 focus:ring-2 focus:ring-dltt-green/20 focus:border-dltt-green outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DataTable
              columns={userColumns}
              rows={filteredUsers}
              rowKey={(user) => user.uid}
              emptyMessage="No users match your current search."
              initialPageSize={10}
            />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Teacher Profile Editing</h2>
                <p className="text-sm text-gray-600">
                  Disable the teacher profile form, including account information fields, until it is enabled again.
                </p>
                <p className="mt-1 text-xs font-mono text-gray-400">Stored in {describePortalSettingsStorage()}</p>
              </div>
              <label className="inline-flex items-center gap-3 cursor-pointer">
                <span className="text-sm font-bold text-gray-700">
                  {isTeacherProfileEditingDisabled ? 'Disabled' : 'Enabled'}
                </span>
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isTeacherProfileEditingDisabled}
                  onChange={(e) => handleTeacherProfileEditingToggle(e.target.checked)}
                />
                <span className="relative h-7 w-12 rounded-full bg-gray-200 transition-colors peer-checked:bg-red-500 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5"></span>
              </label>
            </div>
          </div>

          {allowClearAllRecords && (
            <div className="bg-red-50 rounded-2xl p-8 border border-red-100">
              <div className="flex items-center space-x-3 mb-4 text-red-600">
                <AlertTriangle size={24} />
                <h2 className="text-xl font-bold">Danger Zone</h2>
              </div>
              <p className="text-red-700 mb-6 max-w-2xl">
                Clearing users only removes their Firestore records. You must still manually remove their authentication
                accounts in the Firebase Authentication Console for a full deletion.
              </p>
              <button
                onClick={handleClearAllUsers}
                className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center space-x-2 shadow-sm"
              >
                <Trash2 size={20} />
                <span>Clear All User Records</span>
              </button>
            </div>
          )}
        </>
      )}
      {activeTab === 'materials' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Learning Materials</h2>
            <button onClick={handleOpenAddMaterial} className="btn-primary">
              <Plus size={20} />
              <span>Add Material</span>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {materialWeekGroups.map(({ week, materials: weekMaterials }) => {
              const isExpanded = expandedMaterialWeeks.has(week);

              return (
                <div key={week} className="space-y-3">
                  <button
                    type="button"
                    onClick={() => toggleMaterialWeekExpanded(week)}
                    className="w-full flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3 text-left shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="bg-dltt-green text-white w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold">
                        W{week}
                      </span>
                      <div>
                        <h3 className="font-bold text-gray-900">Week {week} Materials</h3>
                        <p className="text-sm text-gray-500">
                          {weekMaterials.length} item{weekMaterials.length === 1 ? '' : 's'} - newest uploads first
                        </p>
                      </div>
                    </div>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={20} className="text-gray-500" />
                    </motion.div>
                  </button>

                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 gap-4"
                    >
                      {weekMaterials.map((material) => (
                        <div
                          key={material.id}
                          className="card flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                        >
                          <div className="flex items-center space-x-4">
                            <div
                              className={`p-3 rounded-lg ${
                                material.type === 'assignment' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                              }`}
                            >
                              {material.type === 'assignment' ? (
                                <FileText size={24} />
                              ) : material.type === 'video' ? (
                                <Video size={24} />
                              ) : material.type === 'audio' ? (
                                <AudioWaveform size={24} />
                              ) : (
                                <BookOpen size={24} />
                              )}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900">{material.title}</h3>
                              <p className="text-sm text-gray-500">
                                Week {material.week} - {material.type.toUpperCase()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                              <p className="text-xs text-gray-400 uppercase font-bold">States</p>
                              <p className="text-sm text-gray-600">
                                {material.assignedStates.includes('all') ? 'All States' : material.assignedStates.join(', ')}
                              </p>
                            </div>
                            <div className="text-right hidden sm:block">
                              <p className="text-xs text-gray-400 uppercase font-bold">Users</p>
                              <p className="text-sm text-gray-600">
                                {material.assignedTo.includes('all') ? 'All Users' : `${material.assignedTo.length} selected`}
                              </p>
                            </div>
                            <button
                              onClick={() => handleOpenEditMaterial(material)}
                              className="p-2 text-gray-400 hover:text-dltt-green"
                              aria-label={`Edit ${material.title}`}
                            >
                              <Edit size={20} />
                            </button>
                            <button
                              onClick={() => handleDeleteMaterial(material)}
                              className="p-2 text-gray-400 hover:text-red-600"
                              aria-label={`Delete ${material.title}`}
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>
              );
            })}
            {materialWeekGroups.length === 0 && (
              <div className="card text-center text-gray-500">No learning materials have been uploaded yet.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'grading' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Import assessment scores</h2>
              <p className="text-sm text-gray-500">Upload a CSV/Excel file with Email, Score, and Week.</p>
              <p className="mt-2 text-xs text-gray-500">
                Expected columns: <span className="font-semibold">Email, Score, Week</span>.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="inline-flex items-center space-x-2 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 cursor-pointer transition-all">
                <FileSpreadsheet size={18} className="text-emerald-600" />
                <span>{gradeImporting ? 'Importing...' : 'Import Scores'}</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImportGrades}
                  disabled={gradeImporting}
                />
              </label>
              <button
                type="button"
                onClick={handleDownloadScoreTemplate}
                className="inline-flex items-center space-x-2 bg-gray-100 border border-gray-200 rounded-lg px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
              >
                <FileSpreadsheet size={18} className="text-gray-600" />
                <span>Download Template</span>
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Manual grade entry</h3>
            <form onSubmit={handleSubmitManualGrade} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">State</label>
                <select
                  value={manualGradeForm.state}
                  onChange={(e) => setManualGradeForm((f) => ({ ...f, state: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">All States</option>
                  {STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Teacher</label>
                <select
                  required
                  value={manualGradeForm.teacherId}
                  onChange={(e) => setManualGradeForm((f) => ({ ...f, teacherId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select teacher</option>
                  {users
                    .filter(
                      (user) =>
                        user.role === 'teacher' &&
                        (!manualGradeForm.state || user.state === manualGradeForm.state),
                    )
                    .map((user) => (
                      <option key={user.uid} value={user.uid}>
                        {user.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Week</label>
                <select
                  required
                  value={manualGradeForm.week}
                  onChange={(e) => setManualGradeForm((f) => ({ ...f, week: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select week</option>
                  {WEEKS.map((week) => (
                    <option key={week} value={week}>
                      Week {week}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Grade (0-100)</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  value={manualGradeForm.score}
                  onChange={(e) => setManualGradeForm((f) => ({ ...f, score: e.target.value }))}
                  placeholder="0-100"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button type="submit" className="btn-primary w-full">
                  Submit Grade
                </button>
              </div>
            </form>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Assignment & Assessment Library</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Filter assignment and assessment records by week and state, then export the results to Excel.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
                  <select
                    value={gradingLibraryFilters.week}
                    onChange={(e) => setGradingLibraryFilters((filters) => ({ ...filters, week: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                    aria-label="Filter records by week"
                  >
                    <option value="">All Weeks</option>
                    {WEEKS.map((week) => (
                      <option key={week} value={week}>
                        Week {week}
                      </option>
                    ))}
                  </select>
                  <select
                    value={gradingLibraryFilters.state}
                    onChange={(e) => setGradingLibraryFilters((filters) => ({ ...filters, state: e.target.value }))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                    aria-label="Filter records by state"
                  >
                    <option value="">All States</option>
                    {STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  <select
                    value={gradingLibraryFilters.type}
                    onChange={(e) =>
                      setGradingLibraryFilters((filters) => ({
                        ...filters,
                        type: e.target.value as GradingRecordType,
                      }))
                    }
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                    aria-label="Filter records by type"
                  >
                    <option value="all">Assignments & Assessments</option>
                    <option value="assignment">Assignments</option>
                    <option value="assessment">Assessments</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm font-medium text-gray-600">
                  {gradingLibrarySubmissions.length} record{gradingLibrarySubmissions.length === 1 ? '' : 's'} found
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadGradingLibrary}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-dltt-green px-3 py-2 text-sm font-bold text-white hover:bg-dltt-green-dark"
                  >
                    <Download size={16} />
                    Download Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => setGradingLibraryFilters({ week: '', state: '', type: 'all' })}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>
            <DataTable
              columns={gradingLibraryColumns}
              rows={gradingLibrarySubmissions}
              rowKey={(submission) => submission.id}
              emptyMessage="No assignment or assessment records match these filters."
              initialPageSize={10}
            />
          </div>
          <div className="space-y-4">
            {importPreviewRows.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Preview imported rows</h3>
                    <p className="text-sm text-gray-500">
                      {importPreviewRows.length} row(s) loaded from {importPreviewFileName}. Confirm to write the ready rows to the database.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleConfirmImportGrades}
                      className="btn-primary"
                      disabled={gradeImporting || importPreviewRows.every((row) => row.status !== 'ready')}
                    >
                      Confirm Upload
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelImportPreview}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="min-w-full text-left text-sm text-gray-700">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 font-semibold">#</th>
                        <th className="px-4 py-3 font-semibold">Email</th>
                        <th className="px-4 py-3 font-semibold">Score</th>
                        <th className="px-4 py-3 font-semibold">Week</th>
                        <th className="px-4 py-3 font-semibold">Teacher</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreviewRows.map((row) => (
                        <tr key={row.rowNumber} className="border-t border-gray-100">
                          <td className="px-4 py-3">{row.rowNumber}</td>
                          <td className="px-4 py-3">{row.teacherEmail}</td>
                          <td className="px-4 py-3">{row.score}</td>
                          <td className="px-4 py-3">{row.week ?? '-'}</td>
                          <td className="px-4 py-3">{row.teacherName ?? 'Not found'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                              row.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {row.status === 'ready' ? 'Ready' : row.reason}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {pendingSubmissions.map((submission) => {
              const teacher = users.find((user) => user.uid === submission.teacherId);
              const material = materials.find((item) => item.id === submission.materialId);
              const draft = gradeDrafts[submission.id] || { score: '', feedback: '' };

              return (
                <div key={submission.id} className="card">
                  <div className="flex justify-between items-start mb-4 gap-4">
                    <div>
                      <h3 className="font-bold text-gray-900">{teacher?.name || 'Unknown User'}</h3>
                      <p className="text-sm text-gray-500">Assignment: {material?.title || 'Unknown Assignment'}</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                      Pending Grade
                    </span>
                  </div>
                  <div className="mb-4">
                    <a
                      href={submission.contentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-dltt-green text-sm font-bold hover:underline"
                    >
                      View Submission Content
                    </a>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Score"
                      className="input-field sm:w-32"
                      value={draft.score}
                      onChange={(e) =>
                        setGradeDrafts((current) => ({
                          ...current,
                          [submission.id]: { ...draft, score: e.target.value },
                        }))
                      }
                    />
                    <input
                      type="text"
                      placeholder="Feedback"
                      className="input-field flex-1"
                      value={draft.feedback}
                      onChange={(e) =>
                        setGradeDrafts((current) => ({
                          ...current,
                          [submission.id]: { ...draft, feedback: e.target.value },
                        }))
                      }
                    />
                    <button onClick={() => handleGradeSubmission(submission.id)} className="btn-primary">
                      Submit Grade
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubmission(submission.id)}
                      className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
            {pendingSubmissions.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-500">No pending submissions to grade.</p>
              </div>
            )}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">Graded submission records</h3>
                <p className="text-sm text-gray-500">Review uploaded and manually graded records, then delete incorrect entries if needed.</p>
              </div>
              <DataTable
                columns={gradedSubmissionColumns}
                rows={gradedSubmissions}
                rowKey={(submission) => submission.id}
                emptyMessage="No graded submission records yet."
                initialPageSize={10}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'promotion' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Eligible for Promotion</p>
              <p className="text-3xl font-bold text-blue-600">{users.filter((user) => canPromoteRole(user.role)).length}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Trainers</p>
              <p className="text-3xl font-bold text-amber-600">{trainerCount}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Senior / Master</p>
              <p className="text-3xl font-bold text-violet-600">{seniorTrainerCount + masterTrainerCount}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-500">Selected</p>
              <p className="text-3xl font-bold text-dltt-green">{selectedPromotionIds.size}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-50/30">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Growth Path Promotion</h2>
                <p className="text-sm text-gray-500">
                  Select one or more eligible users, then advance them one step: Teacher, Trainer, Senior Trainer, then Master Trainer.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const visibleIds = promotionCandidates.map((teacher) => teacher.uid);
                    const allVisibleSelected =
                      visibleIds.length > 0 && visibleIds.every((teacherId) => selectedPromotionIds.has(teacherId));

                    setSelectedPromotionIds((current) => {
                      const next = new Set(current);
                      visibleIds.forEach((teacherId) => {
                        if (allVisibleSelected) {
                          next.delete(teacherId);
                        } else {
                          next.add(teacherId);
                        }
                      });
                      return next;
                    });
                  }}
                  disabled={promotionCandidates.length === 0}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {promotionCandidates.length > 0 &&
                  promotionCandidates.every((teacher) => selectedPromotionIds.has(teacher.uid))
                    ? 'Clear Visible'
                    : 'Select Visible'}
                </button>
                <button
                  type="button"
                  onClick={handleBulkPromoteUsers}
                  disabled={selectedPromotionIds.size === 0}
                  className="bg-dltt-green text-white px-5 py-2 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  Promote Selected
                </button>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search candidates..."
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm w-full sm:w-72 focus:ring-2 focus:ring-dltt-green/20 focus:border-dltt-green outline-none transition-all"
                    value={promotionSearchTerm}
                    onChange={(event) => setPromotionSearchTerm(event.target.value)}
                  />
                </div>
              </div>
            </div>
            <DataTable
              columns={promotionColumns}
              rows={promotionCandidates}
              rowKey={(teacher) => teacher.uid}
              emptyMessage="No teacher accounts are currently eligible for promotion."
              initialPageSize={10}
            />
          </div>
        </div>
      )}

      {editingGrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Grade</h2>
              <button
                type="button"
                aria-label="Close grade editor"
                onClick={() => setEditingGrade(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleUpdateGradedSubmission} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Score</label>
                  <input
                    required
                    type="number"
                    min="0"
                    max="100"
                    className="input-field"
                    value={editingGrade.score}
                    onChange={(e) => setEditingGrade({ ...editingGrade, score: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">Submitted Assignment URL</label>
                  <input
                    required
                    type="url"
                    placeholder="https://..."
                    className="input-field"
                    value={editingGrade.contentUrl}
                    onChange={(e) => setEditingGrade({ ...editingGrade, contentUrl: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Feedback</label>
                <textarea
                  className="input-field min-h-28"
                  value={editingGrade.feedback}
                  onChange={(e) => setEditingGrade({ ...editingGrade, feedback: e.target.value })}
                />
              </div>
              <div className="flex space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingGrade(null)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 justify-center">
                  Update Grade
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Create New User</h2>
              <button
                type="button"
                aria-label="Close create user form"
                onClick={() => setShowAddUser(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  className="input-field"
                  value={newUser.name || ''}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
                <input
                  required
                  type="email"
                  className="input-field"
                  value={newUser.email || ''}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Phone Number</label>
                <input
                  required
                  type="tel"
                  className="input-field"
                  value={newUser.phone || ''}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Role</label>
                <select
                  className="input-field"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                >
                  <option value="teacher">Teacher</option>
                  <option value="trainer">Trainer</option>
                  <option value="senior-trainer">Senior Trainer</option>
                  <option value="master-trainer">Master Trainer</option>
                  <option value="admin">Admin</option>
                  <option value="super-admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">State</label>
                <select
                  className="input-field"
                  value={newUser.state}
                  onChange={(e) => setNewUser({ ...newUser, state: e.target.value })}
                >
                  {STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showEditUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit User</h2>
              <button
                type="button"
                aria-label="Close edit user form"
                onClick={() => setShowEditUser(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  className="input-field"
                  value={showEditUser.name}
                  onChange={(e) => setShowEditUser({ ...showEditUser, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
                <input
                  required
                  type="email"
                  className="input-field"
                  value={showEditUser.email}
                  onChange={(e) => setShowEditUser({ ...showEditUser, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Phone Number</label>
                <input
                  required
                  type="tel"
                  className="input-field"
                  value={showEditUser.phone}
                  onChange={(e) => setShowEditUser({ ...showEditUser, phone: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Role</label>
                  <select
                    className="input-field"
                    value={showEditUser.role}
                    onChange={(e) => setShowEditUser({ ...showEditUser, role: e.target.value as UserRole })}
                  >
                    <option value="teacher">Teacher</option>
                    <option value="trainer">Trainer</option>
                    <option value="senior-trainer">Senior Trainer</option>
                    <option value="master-trainer">Master Trainer</option>
                    <option value="admin">Admin</option>
                    <option value="super-admin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">State</label>
                  <select
                    className="input-field"
                    value={showEditUser.state}
                    onChange={(e) => setShowEditUser({ ...showEditUser, state: e.target.value })}
                  >
                    {STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">School</label>
                <input
                  type="text"
                  className="input-field"
                  value={showEditUser.school || ''}
                  onChange={(e) => setShowEditUser({ ...showEditUser, school: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Gender</label>
                <select
                  className="input-field"
                  value={showEditUser.gender || ''}
                  onChange={(e) => setShowEditUser({ ...showEditUser, gender: e.target.value || undefined })}
                >
                  <option value="">Not specified</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Account Number</label>
                <input
                  type="text"
                  className="input-field"
                  value={showEditUser.accountNumber || ''}
                  onChange={(e) => setShowEditUser({ ...showEditUser, accountNumber: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={showEditUser.bank || ''}
                  onChange={(e) => setShowEditUser({ ...showEditUser, bank: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Account Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={showEditUser.accountName || ''}
                  onChange={(e) => setShowEditUser({ ...showEditUser, accountName: e.target.value })}
                />
              </div>
              {showEditUser.role === 'teacher' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Attendance by Week</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {WEEKS.map((week) => {
                      const key = `week${week}`;
                      const attended = !!showEditUser.attendance?.[key];

                      return (
                        <label
                          key={week}
                          className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center justify-between ${
                            attended ? 'border-green-100 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-600'
                          }`}
                        >
                          <span>Week {week}</span>
                          <input
                            type="checkbox"
                            checked={attended}
                            onChange={(e) =>
                              setShowEditUser({
                                ...showEditUser,
                                attendance: {
                                  ...(showEditUser.attendance || {}),
                                  [key]: e.target.checked,
                                },
                              })
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditUser(null)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Update
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showAddMaterial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingMaterial ? 'Edit Learning Material' : 'Add Learning Material'}
              </h2>
              <button
                type="button"
                aria-label="Close material form"
                onClick={handleCloseMaterialForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveMaterial} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Title</label>
                <input
                  required
                  type="text"
                  className="input-field"
                  value={newMaterial.title || ''}
                  onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  className="input-field"
                  value={newMaterial.description || ''}
                  onChange={(e) => setNewMaterial({ ...newMaterial, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
                  <select
                    className="input-field"
                    value={newMaterial.type}
                    onChange={(e) => setNewMaterial({ ...newMaterial, type: e.target.value as LearningMaterial['type'] })}
                  >
                    <option value="slide">Slide</option>
                    <option value="pdf">PDF</option>
                    <option value="assignment">Assignment</option>
                    <option value="video">Video</option>
                    <option value="audio">Audio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Week</label>
                  <select
                    className="input-field"
                    value={newMaterial.week}
                    onChange={(e) => setNewMaterial({ ...newMaterial, week: Number.parseInt(e.target.value, 10) })}
                  >
                    {WEEKS.map((week) => (
                      <option key={week} value={week}>
                        Week {week}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Content URL</label>
                <input
                  required
                  type="url"
                  placeholder="https://..."
                  className="input-field"
                  value={newMaterial.contentUrl || ''}
                  onChange={(e) => setNewMaterial({ ...newMaterial, contentUrl: e.target.value })}
                />
              </div>
              {newMaterial.type === 'assignment' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Due Date</label>
                  <input
                    required
                    type="date"
                    className="input-field"
                    value={newMaterial.dueDate || ''}
                    onChange={(e) => setNewMaterial({ ...newMaterial, dueDate: e.target.value })}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Assign to States</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newMaterial.assignedStates.includes('all')}
                      onChange={(e) =>
                        setNewMaterial({
                          ...newMaterial,
                          assignedStates: e.target.checked ? ['all'] : [],
                        })
                      }
                    />
                    <span className="text-sm">All States</span>
                  </label>
                  {STATES.map((state) => (
                    <label key={state} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newMaterial.assignedStates.includes(state)}
                        disabled={newMaterial.assignedStates.includes('all')}
                        onChange={() => toggleAssignedState(state)}
                      />
                      <span className="text-sm">{state}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Assign to Specific Users</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-xl border border-gray-200 p-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={newMaterial.assignedTo.includes('all')}
                      onChange={(e) =>
                        setNewMaterial({
                          ...newMaterial,
                          assignedTo: e.target.checked ? ['all'] : [],
                        })
                      }
                    />
                    <span className="text-sm font-medium">All Users</span>
                  </label>
                  {users.map((user) => (
                    <label key={user.uid} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newMaterial.assignedTo.includes(user.uid)}
                        disabled={newMaterial.assignedTo.includes('all')}
                        onChange={() => toggleAssignedUser(user.uid)}
                      />
                      <span className="text-sm">
                        {user.name} <span className="text-gray-400">({user.role})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex space-x-4 mt-6">
                <button
                  type="button"
                  onClick={handleCloseMaterialForm}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 justify-center">
                  {editingMaterial ? 'Update Material' : 'Create Material'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((current) => ({ ...current, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isDanger={confirmDialog.isDanger}
      />

      {notification && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
      )}
    </div>
  );
}
