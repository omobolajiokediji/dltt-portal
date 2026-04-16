import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle,
  Edit,
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
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { auth, secondaryAuth, db } from '../lib/firebase';
import { STATES, WEEKS } from '../constants';
import { AssignmentSubmission, LearningMaterial, UserProfile, UserRole } from '../types';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { getTeacherProgress, syncTrainingDerivedData } from '../lib/training';
import ConfirmDialog from './ConfirmDialog';
import DataTable, { DataTableColumn } from './DataTable';
import Notification, { NotificationType } from './Notification';

type MaterialFormState = Partial<LearningMaterial> & {
  assignedTo: string[];
  assignedStates: string[];
};

type GradeDraftState = Record<string, { score: string; feedback: string }>;

const defaultMaterialState: MaterialFormState = {
  type: 'slide',
  week: 1,
  assignedTo: ['all'],
  assignedStates: ['all'],
};

const defaultNewUser: Partial<UserProfile> = {
  role: 'teacher',
  state: 'Lagos State',
  approvedForCertificate: false,
  totalScore: 0,
  attendance: {},
  assignmentCompletion: {},
  phone: '',
};

export default function SuperAdminDashboard() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'materials' | 'grading'>('users');
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState<UserProfile | null>(null);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [newMaterial, setNewMaterial] = useState<MaterialFormState>(defaultMaterialState);
  const [newUser, setNewUser] = useState<Partial<UserProfile>>(defaultNewUser);
  const [gradeDrafts, setGradeDrafts] = useState<GradeDraftState>({});
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

    return () => {
      unsubUsers();
      unsubMaterials();
      unsubSubmissions();
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

  const teacherProgressMap = useMemo(() => {
    return new Map(
      users
        .filter((user) => user.role === 'teacher')
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

  const teacherCount = users.filter((user) => user.role === 'teacher').length;
  const adminCount = users.filter((user) => user.role === 'admin').length;

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
                : 'bg-blue-50 text-blue-700'
          }`}
        >
          <Shield size={12} className="mr-1" />
          {user.role}
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
      sortValue: (user) => (user.role === 'teacher' ? (teacherProgressMap.get(user.uid)?.totalScore ?? 0) : -1),
      render: (user) => {
        const progress = user.role === 'teacher' ? teacherProgressMap.get(user.uid) : null;
        return <span className="text-sm text-gray-600">{progress ? `${progress.totalScore} pts / ${progress.attendanceCount} attendance weeks` : 'N/A'}</span>;
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
        attendance: showEditUser.attendance || {},
      });
      setShowEditUser(null);
      setNotification({ message: 'User updated successfully.', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
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
              role: ['teacher', 'admin', 'super-admin'].includes(role) ? role : 'teacher',
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

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const materialRef = doc(collection(db, 'materials'));
      const materialData = {
        ...newMaterial,
        id: materialRef.id,
        createdAt: new Date().toISOString(),
        assignedTo: newMaterial.assignedTo.length > 0 ? newMaterial.assignedTo : ['all'],
        assignedStates: newMaterial.assignedStates.length > 0 ? newMaterial.assignedStates : ['all'],
      } as LearningMaterial;

      await setDoc(materialRef, materialData);
      setShowAddMaterial(false);
      setNewMaterial(defaultMaterialState);
      setNotification({ message: 'Material added successfully.', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'materials');
    }
  };

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
      message: `Delete "${material.title}"? This cannot be undone.`,
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'materials', material.firestoreId || material.id));
          setNotification({ message: 'Material deleted successfully.', type: 'success' });
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/30">
              <h2 className="text-xl font-bold text-gray-900">User Management</h2>
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
            <DataTable
              columns={userColumns}
              rows={filteredUsers}
              rowKey={(user) => user.uid}
              emptyMessage="No users match your current search."
              initialPageSize={10}
            />
          </div>

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
        </>
      )}
      {activeTab === 'materials' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Learning Materials</h2>
            <button onClick={() => setShowAddMaterial(true)} className="btn-primary">
              <Plus size={20} />
              <span>Add Material</span>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {materials
              .slice()
              .sort((a, b) => a.week - b.week)
              .map((material) => (
                <div key={material.id} className="card flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div
                      className={`p-3 rounded-lg ${
                        material.type === 'assignment' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      <FileText size={24} />
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
                    <button onClick={() => handleDeleteMaterial(material)} className="p-2 text-gray-400 hover:text-red-600">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {activeTab === 'grading' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Grading and Assessments</h2>
          <div className="space-y-4">
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
                  </div>
                </div>
              );
            })}
            {pendingSubmissions.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                <p className="text-gray-500">No pending submissions to grade.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New User</h2>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit User</h2>
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
              <h2 className="text-2xl font-bold text-gray-900">Add Learning Material</h2>
              <button onClick={() => setShowAddMaterial(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleAddMaterial} className="space-y-4">
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
              <button type="submit" className="btn-primary w-full mt-4">
                Create Material
              </button>
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
