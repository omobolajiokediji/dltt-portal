import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { CheckCircle, Edit, FileSpreadsheet, FileText, MapPin, Plus, Search, Trash2, Users, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { secondaryAuth, db } from '../lib/firebase';
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

export default function AdminDashboard() {
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<'materials' | 'teachers' | 'grading'>('materials');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState<UserProfile | null>(null);
  const [newMaterial, setNewMaterial] = useState<MaterialFormState>(defaultMaterialState);
  const [gradeDrafts, setGradeDrafts] = useState<GradeDraftState>({});
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
    const unsubMaterials = onSnapshot(
      collection(db, 'materials'),
      (snapshot) => {
        setMaterials(
          snapshot.docs.map((item) => ({ ...(item.data() as LearningMaterial), firestoreId: item.id })) as LearningMaterial[],
        );
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'materials'),
    );

    const unsubTeachers = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'teacher')),
      (snapshot) => {
        setTeachers(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() })) as UserProfile[]);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users'),
    );

    const unsubSubmissions = onSnapshot(
      collection(db, 'submissions'),
      (snapshot) => {
        setSubmissions(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as AssignmentSubmission[]);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'submissions'),
    );

    return () => {
      unsubMaterials();
      unsubTeachers();
      unsubSubmissions();
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    syncTrainingDerivedData(db, teachers, materials, submissions).catch((error) => {
      console.error('Failed to sync derived training data:', error);
    });
  }, [loading, teachers, materials, submissions]);

  const teacherProgressMap = useMemo(
    () => new Map(teachers.map((teacher) => [teacher.uid, getTeacherProgress(teacher, materials, submissions)])),
    [teachers, materials, submissions],
  );

  const filteredTeachers = teachers.filter((teacher) => {
    const searchValue = searchTerm.toLowerCase();
    return (
      teacher.name.toLowerCase().includes(searchValue) ||
      teacher.email.toLowerCase().includes(searchValue) ||
      (teacher.phone || '').includes(searchTerm)
    );
  });

  const pendingSubmissions = submissions
    .filter((submission) => submission.status === 'pending')
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));

  const teacherColumns: DataTableColumn<UserProfile>[] = [
    {
      key: 'teacher',
      header: 'Teacher',
      sortable: true,
      sortValue: (teacher) => teacher.name,
      render: (teacher) => (
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            {teacher.name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-gray-900 leading-none mb-1">{teacher.name}</p>
            <p className="text-xs text-gray-500 font-medium">{teacher.email || 'No email'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'state',
      header: 'State',
      sortable: true,
      sortValue: (teacher) => teacher.state,
      render: (teacher) => (
        <div className="flex items-center text-sm text-gray-600 font-medium">
          <MapPin size={14} className="mr-1.5 text-gray-400" />
          {teacher.state}
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      sortable: true,
      sortValue: (teacher) => teacherProgressMap.get(teacher.uid)?.completionRate ?? 0,
      render: (teacher) => {
        const progress = teacherProgressMap.get(teacher.uid)!;
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <span>{progress.submittedAssignments}/{progress.totalAssignments} submitted</span>
              <span>{progress.totalScore} pts</span>
            </div>
            <div className="w-40 bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-dltt-green h-full rounded-full transition-all duration-500"
                style={{ width: `${progress.completionRate}%` }}
              ></div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'attendance',
      header: 'Attendance',
      sortable: true,
      sortValue: (teacher) => teacherProgressMap.get(teacher.uid)?.attendanceCount ?? 0,
      render: (teacher) => {
        const progress = teacherProgressMap.get(teacher.uid)!;
        return <span className="text-sm text-gray-600">{progress.attendanceCount}/4 weeks</span>;
      },
    },
    {
      key: 'certificate',
      header: 'Certificate',
      sortable: true,
      sortValue: (teacher) => (teacher.approvedForCertificate ? 1 : 0),
      headerClassName: 'text-center',
      className: 'text-center',
      render: (teacher) => (
        <button
          onClick={() => handleApproveCertificate(teacher.uid, !teacher.approvedForCertificate)}
          className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold transition-all ${
            teacher.approvedForCertificate
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {teacher.approvedForCertificate ? 'Approved' : 'Approve'}
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (teacher) => (
        <div className="flex items-center justify-end space-x-2">
          <div className="text-xs text-gray-400 mr-2 bg-gray-50 px-2 py-1 rounded font-mono">
            {teacher.phone || 'No Phone'}
          </div>
          <button
            onClick={() => setShowEditProfile(teacher)}
            className="p-2 text-gray-400 hover:text-dltt-green hover:bg-green-50 rounded-lg transition-all"
          >
            <Edit size={18} />
          </button>
        </div>
      ),
    },
  ];

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
      setNotification({ message: 'Material created successfully.', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'materials');
    }
  };

  const handleDeleteMaterial = (material: LearningMaterial) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Material',
      message: `Delete "${material.title}"? This will remove it from teacher dashboards.`,
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'materials', material.firestoreId || material.id));
          setNotification({ message: 'Material deleted.', type: 'success' });
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'materials');
        }
      },
    });
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
      setNotification({ message: 'Grade submitted successfully.', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'submissions');
    }
  };

  const handleApproveCertificate = async (teacherId: string, approved: boolean) => {
    try {
      await updateDoc(doc(db, 'users', teacherId), {
        approvedForCertificate: approved,
      });
      setNotification({
        message: approved ? 'Certificate approved.' : 'Certificate approval removed.',
        type: 'success',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditProfile) {
      return;
    }

    try {
      await updateDoc(doc(db, 'users', showEditProfile.uid), {
        name: showEditProfile.name,
        email: showEditProfile.email,
        phone: showEditProfile.phone,
        state: showEditProfile.state,
        school: showEditProfile.school || '',
        attendance: showEditProfile.attendance || {},
      });
      setShowEditProfile(null);
      setNotification({ message: 'Teacher profile updated.', type: 'success' });
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
          const state = String(row.State || row.state || row.STATE || 'Lagos State').trim();
          const role = String(row.Role || row.role || row.ROLE || 'teacher').trim().toLowerCase() as UserRole;

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

  const toggleAssignedState = (state: string) => {
    const current = newMaterial.assignedStates || [];
    setNewMaterial({
      ...newMaterial,
      assignedStates: current.includes(state) ? current.filter((item) => item !== state) : [...current, state],
    });
  };

  const toggleAssignedTeacher = (teacherId: string) => {
    const current = newMaterial.assignedTo || [];
    setNewMaterial({
      ...newMaterial,
      assignedTo: current.includes(teacherId) ? current.filter((item) => item !== teacherId) : [...current, teacherId],
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
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600">Manage learning materials, teachers, attendance, and assessments.</p>
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
          {activeTab === 'materials' && (
            <button onClick={() => setShowAddMaterial(true)} className="btn-primary">
              <Plus size={20} />
              <span>Add Material</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex space-x-4 mb-8 border-b border-gray-200 overflow-x-auto">
        {[
          { id: 'materials', label: 'Materials', icon: FileText },
          { id: 'teachers', label: 'Teachers', icon: Users },
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

      <div className="space-y-6">
        {activeTab === 'materials' && (
          <div className="grid grid-cols-1 gap-4">
            {materials
              .slice()
              .sort((a, b) => a.week - b.week)
              .map((material) => (
                <div
                  key={material.id}
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                >
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

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-gray-400 uppercase font-bold">States</p>
                      <p className="text-sm text-gray-600">
                        {material.assignedStates.includes('all') ? 'All States' : material.assignedStates.join(', ')}
                      </p>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-400 uppercase font-bold">Teachers</p>
                      <p className="text-sm text-gray-600">
                        {material.assignedTo.includes('all') ? 'All Teachers' : `${material.assignedTo.length} selected`}
                      </p>
                    </div>
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
            {materials.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200 text-gray-500">
                No materials created yet.
              </div>
            )}
          </div>
        )}

        {activeTab === 'teachers' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/30">
              <h2 className="text-xl font-bold text-gray-900">Teacher Management</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search teachers by name, email or phone..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm w-full sm:w-80 focus:ring-2 focus:ring-dltt-green/20 focus:border-dltt-green outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <DataTable
              columns={teacherColumns}
              rows={filteredTeachers}
              rowKey={(teacher) => teacher.uid}
              emptyMessage="No teachers match your current search."
              initialPageSize={10}
            />
          </div>
        )}
        {activeTab === 'grading' && (
          <div className="space-y-4">
            {pendingSubmissions.map((submission) => {
              const teacher = teachers.find((item) => item.uid === submission.teacherId);
              const material = materials.find((item) => item.id === submission.materialId);
              const draft = gradeDrafts[submission.id] || { score: '', feedback: '' };

              return (
                <div key={submission.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-4 gap-4">
                    <div>
                      <h3 className="font-bold text-gray-900">{teacher?.name || 'Unknown Teacher'}</h3>
                      <p className="text-sm text-gray-500">Assignment: {material?.title || 'Unknown Assignment'}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Submitted {new Date(submission.submittedAt).toLocaleString()}
                      </p>
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
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Score (0-100)"
                      className="border border-gray-200 rounded-lg px-4 py-2 text-sm sm:w-32"
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
                      className="border border-gray-200 rounded-lg px-4 py-2 text-sm flex-1"
                      value={draft.feedback}
                      onChange={(e) =>
                        setGradeDrafts((current) => ({
                          ...current,
                          [submission.id]: { ...draft, feedback: e.target.value },
                        }))
                      }
                    />
                    <button
                      onClick={() => handleGradeSubmission(submission.id)}
                      className="bg-dltt-green text-white px-6 py-2 rounded-lg font-bold text-sm hover:opacity-90"
                    >
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
        )}
      </div>

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
                <label className="block text-sm font-bold text-gray-700 mb-2">Assign to Specific Teachers</label>
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
                    <span className="text-sm font-medium">All Teachers</span>
                  </label>
                  {teachers.map((teacher) => (
                    <label key={teacher.uid} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newMaterial.assignedTo.includes(teacher.uid)}
                        disabled={newMaterial.assignedTo.includes('all')}
                        onChange={() => toggleAssignedTeacher(teacher.uid)}
                      />
                      <span className="text-sm">
                        {teacher.name} <span className="text-gray-400">({teacher.state})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full bg-dltt-green text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity mt-4">
                Create Material
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {showEditProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Teacher Profile</h2>
              <button onClick={() => setShowEditProfile(null)} className="text-gray-400 hover:text-gray-600">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  className="input-field"
                  value={showEditProfile.name}
                  onChange={(e) => setShowEditProfile({ ...showEditProfile, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className="input-field"
                  value={showEditProfile.email}
                  onChange={(e) => setShowEditProfile({ ...showEditProfile, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  className="input-field"
                  value={showEditProfile.phone}
                  onChange={(e) => setShowEditProfile({ ...showEditProfile, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">State</label>
                <select
                  className="input-field"
                  value={showEditProfile.state}
                  onChange={(e) => setShowEditProfile({ ...showEditProfile, state: e.target.value })}
                >
                  {STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">School</label>
                <input
                  type="text"
                  className="input-field"
                  value={showEditProfile.school || ''}
                  onChange={(e) => setShowEditProfile({ ...showEditProfile, school: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Attendance by Week</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {WEEKS.map((week) => {
                    const key = `week${week}`;
                    const attended = !!showEditProfile.attendance?.[key];

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
                            setShowEditProfile({
                              ...showEditProfile,
                              attendance: {
                                ...(showEditProfile.attendance || {}),
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
              <button type="submit" className="w-full bg-dltt-green text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity mt-4">
                Update Profile
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
