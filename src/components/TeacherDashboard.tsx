import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Pencil,
  Trophy,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { AssignmentSubmission, LearningMaterial, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { getTeacherProgress, isMaterialAssignedToUser } from '../lib/training';
import Modal from './Modal';
import Notification, { NotificationType } from './Notification';

interface SubmissionModalState {
  isOpen: boolean;
  materialId: string;
  submissionId?: string;
  title: string;
}

function buildCertificateMarkup(user: UserProfile) {
  const certificateName = user.certificateName?.trim() || user.name;
  const issuedDate = new Date().toLocaleDateString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1400" height="1000" viewBox="0 0 1400 1000" xmlns="http://www.w3.org/2000/svg">
  <rect width="1400" height="1000" fill="#f8f6ef"/>
  <rect x="40" y="40" width="1320" height="920" rx="28" fill="none" stroke="#1b8e46" stroke-width="6"/>
  <rect x="70" y="70" width="1260" height="860" rx="24" fill="none" stroke="#d8c65d" stroke-width="2"/>
  <text x="700" y="165" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="#1b8e46">Odu&apos;a Investment Foundation</text>
  <text x="700" y="245" text-anchor="middle" font-family="Georgia, serif" font-size="84" font-weight="700" fill="#171717">Certificate of Completion</text>
  <text x="700" y="320" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#444">This certifies that</text>
  <text x="700" y="430" text-anchor="middle" font-family="Georgia, serif" font-size="64" font-weight="700" fill="#1b8e46">${certificateName}</text>
  <line x1="340" y1="455" x2="1060" y2="455" stroke="#d8c65d" stroke-width="2"/>
  <text x="700" y="530" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#333">has successfully completed the Digital Literacy Training for Teachers (DLTT) programme.</text>
  <text x="700" y="610" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#666">Issued on ${issuedDate}</text>
  <text x="220" y="835" font-family="Arial, sans-serif" font-size="22" fill="#333">Programme: DEFINED Project</text>
  <text x="220" y="875" font-family="Arial, sans-serif" font-size="22" fill="#333">Certificate Name: ${certificateName}</text>
  <line x1="980" y1="820" x2="1180" y2="820" stroke="#1b8e46" stroke-width="3"/>
  <text x="1080" y="860" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#333">Programme Approval</text>
</svg>`;
}

export default function TeacherDashboard({ user }: { user: UserProfile }) {
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'materials' | 'assignments' | 'certificate' | 'profile'>('materials');
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
  const [submissionModal, setSubmissionModal] = useState<SubmissionModalState>({
    isOpen: false,
    materialId: '',
    title: '',
  });
  const [submissionUrl, setSubmissionUrl] = useState('');

  useEffect(() => {
    if (!user.uid) {
      return;
    }

    const materialsQuery = query(collection(db, 'materials'), where('week', '>', 0));
    const submissionsQuery = query(collection(db, 'submissions'), where('teacherId', '==', user.uid));

    const unsubMaterials = onSnapshot(
      materialsQuery,
      (snapshot) => {
        const allMaterials = snapshot.docs.map((materialDoc) => ({
          ...(materialDoc.data() as LearningMaterial),
          firestoreId: materialDoc.id,
        })) as LearningMaterial[];

        const filteredMaterials = allMaterials
          .filter((material) => isMaterialAssignedToUser(material, user))
          .sort((a, b) => a.week - b.week);

        setMaterials(filteredMaterials);
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'materials'),
    );

    const unsubSubmissions = onSnapshot(
      submissionsQuery,
      (snapshot) => {
        const teacherSubmissions = snapshot.docs
          .map((submissionDoc) => ({ id: submissionDoc.id, ...submissionDoc.data() }))
          .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt)) as AssignmentSubmission[];

        setSubmissions(teacherSubmissions);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'submissions'),
    );

    return () => {
      unsubMaterials();
      unsubSubmissions();
    };
  }, [user]);

  const assignmentMaterials = useMemo(
    () => materials.filter((material) => material.type === 'assignment'),
    [materials],
  );

  const latestSubmissionByMaterial = useMemo(() => {
    const latest = new Map<string, AssignmentSubmission>();

    for (const submission of submissions) {
      const existing = latest.get(submission.materialId);
      if (!existing || Date.parse(submission.submittedAt) >= Date.parse(existing.submittedAt)) {
        latest.set(submission.materialId, submission);
      }
    }

    return latest;
  }, [submissions]);

  const progress = useMemo(() => getTeacherProgress(user, materials, submissions), [materials, submissions, user]);
  const certificateReadyHint =
    progress.totalAssignments > 0 &&
    progress.submittedAssignments === progress.totalAssignments &&
    progress.attendanceCount === 4;

  const handleOpenSubmissionModal = (material: LearningMaterial, submission?: AssignmentSubmission) => {
    setSubmissionModal({
      isOpen: true,
      materialId: material.id,
      submissionId: submission?.id,
      title: material.title,
    });
    setSubmissionUrl(submission?.contentUrl ?? '');
  };

  const handleSubmitAssignment = async () => {
    try {
      const submissionRef = submissionModal.submissionId
        ? doc(db, 'submissions', submissionModal.submissionId)
        : doc(collection(db, 'submissions'));

      await setDoc(
        submissionRef,
        {
          id: submissionRef.id,
          teacherId: user.uid,
          materialId: submissionModal.materialId,
          contentUrl: submissionUrl.trim(),
          submittedAt: new Date().toISOString(),
          status: 'pending',
          score: null,
          feedback: '',
        },
        { merge: false },
      );

      setNotification({
        message: submissionModal.submissionId ? 'Submission updated successfully.' : 'Assignment submitted successfully.',
        type: 'success',
      });
      setSubmissionModal({ isOpen: false, materialId: '', title: '' });
      setSubmissionUrl('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'submissions');
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const certificateName = String(formData.get('certName') || '').trim();
    const phone = String(formData.get('phone') || '').trim();

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        certificateName,
        phone,
      });
      setNotification({ message: 'Profile updated successfully.', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleCertificateDownload = () => {
    const certificateMarkup = buildCertificateMarkup(user);
    const blob = new Blob([certificateMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeName = (user.certificateName || user.name || 'dltt-certificate').replace(/[^a-z0-9]+/gi, '-');

    anchor.href = objectUrl;
    anchor.download = `${safeName.toLowerCase()}-dltt-certificate.svg`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
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
      <div className="mb-8 space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {user.name}</h1>
          <p className="text-gray-600">Track your progress and access learning materials for the DLTT program.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Assignments Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {progress.submittedAssignments}/{progress.totalAssignments}
                </p>
              </div>
              <FileText className="text-dltt-green" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Score</p>
                <p className="text-2xl font-bold text-gray-900">{progress.totalScore} pts</p>
              </div>
              <Trophy className="text-dltt-green" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Attendance</p>
                <p className="text-2xl font-bold text-gray-900">
                  {progress.attendanceCount}/4 weeks
                </p>
              </div>
              <Users className="text-dltt-green" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex space-x-4 mb-8 border-b border-gray-200 overflow-x-auto">
        {[
          { id: 'materials', label: 'Learning Materials', icon: BookOpen },
          { id: 'assignments', label: 'My Submissions', icon: FileText },
          { id: 'certificate', label: 'Certificate', icon: Award },
          { id: 'profile', label: 'Profile', icon: Users },
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

      <div className="grid grid-cols-1 gap-8">
        {activeTab === 'materials' && (
          <div className="space-y-6">
            {[1, 2, 3, 4].map((week) => (
              <div key={week} className="space-y-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center space-x-2">
                  <span className="bg-dltt-green text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">
                    W{week}
                  </span>
                  <span>Week {week} Materials</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {materials
                    .filter((material) => material.week === week)
                    .map((material) => {
                      const latestSubmission = latestSubmissionByMaterial.get(material.id);
                      const canEditSubmission = material.type === 'assignment' && latestSubmission?.status !== 'graded';

                      return (
                        <div
                          key={material.id}
                          className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start mb-4 gap-3">
                            <div
                              className={`p-2 rounded-lg ${
                                material.type === 'assignment' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                              }`}
                            >
                              {material.type === 'assignment' ? <FileText size={20} /> : <BookOpen size={20} />}
                            </div>
                            {material.type === 'assignment' && material.dueDate && (
                              <span className="text-xs font-medium px-2 py-1 bg-yellow-50 text-yellow-700 rounded-full">
                                Due: {new Date(material.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          <h3 className="font-bold text-gray-900 mb-2">{material.title}</h3>
                          <p className="text-sm text-gray-600 mb-4 line-clamp-3">{material.description}</p>

                          <div className="space-y-2">
                            <a
                              href={material.contentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                            >
                              View {material.type === 'assignment' ? 'Task' : 'Material'}
                            </a>

                            {material.type === 'assignment' && (
                              <>
                                {!latestSubmission ? (
                                  <button
                                    onClick={() => handleOpenSubmissionModal(material)}
                                    className="w-full bg-dltt-green text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                                  >
                                    Submit
                                  </button>
                                ) : canEditSubmission ? (
                                  <button
                                    onClick={() => handleOpenSubmissionModal(material, latestSubmission)}
                                    className="w-full bg-white text-dltt-green border border-dltt-green px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-50 transition-colors"
                                  >
                                    Edit Submission
                                  </button>
                                ) : (
                                  <div className="text-xs font-medium bg-green-50 text-green-700 px-3 py-2 rounded-lg">
                                    Submission graded and locked.
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  {materials.filter((material) => material.week === week).length === 0 && (
                    <p className="text-gray-500 italic text-sm py-4">No materials uploaded for this week yet.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">Assignment</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">Submitted Date</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">Status</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">Score</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">Feedback</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => {
                  const material = assignmentMaterials.find((item) => item.id === submission.materialId);
                  const isLatestSubmission = latestSubmissionByMaterial.get(submission.materialId)?.id === submission.id;
                  const canEdit = submission.status === 'pending' && isLatestSubmission && material;

                  return (
                    <tr key={submission.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{material?.title || 'Unknown Assignment'}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(submission.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            submission.status === 'graded' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                          }`}
                        >
                          {submission.status === 'graded' ? 'Graded' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {typeof submission.score === 'number' ? `${submission.score}/100` : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {submission.feedback || 'No feedback yet'}
                      </td>
                      <td className="px-6 py-4">
                        {canEdit ? (
                          <button
                            onClick={() => handleOpenSubmissionModal(material, submission)}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-dltt-green hover:underline"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {submissions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      You haven&apos;t submitted any assignments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'certificate' && (
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
            {user.approvedForCertificate ? (
              <div className="text-center space-y-6">
                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <Award size={48} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Congratulations!</h2>
                  <p className="text-gray-600">Your certificate is ready to download.</p>
                </div>
                <button
                  onClick={handleCertificateDownload}
                  className="bg-dltt-green text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg shadow-green-200"
                >
                  Download Digital Certificate
                </button>
              </div>
            ) : (
              <div className="text-center space-y-4 max-w-md px-6">
                <div className="w-20 h-20 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto">
                  <Clock size={40} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Certificate Pending</h2>
                <p className="text-gray-600">
                  Your certificate becomes available after an admin reviews your activity and approves course completion.
                </p>
                <div className="bg-blue-50 p-4 rounded-xl text-left space-y-3">
                  <h3 className="text-sm font-bold text-blue-800 flex items-center">
                    <AlertCircle size={16} className="mr-2" />
                    Readiness Snapshot
                  </h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li className="flex items-center">
                      <CheckCircle2 size={14} className="mr-2" />
                      Assignments submitted: {progress.submittedAssignments}/{progress.totalAssignments}
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 size={14} className="mr-2" />
                      Attendance recorded: {progress.attendanceCount}/4 weeks
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 size={14} className="mr-2" />
                      Score earned: {progress.totalScore} points
                    </li>
                  </ul>
                  {certificateReadyHint && (
                    <p className="text-sm text-blue-800 font-medium">
                      Your activity looks complete. The last step is admin approval.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-2xl mx-auto w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Profile</h2>
            <form className="space-y-6" onSubmit={handleProfileUpdate}>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Full Name (for Certificate)</label>
                <input
                  type="text"
                  name="certName"
                  defaultValue={user.certificateName || user.name}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-dltt-green outline-none"
                  placeholder="Enter your name exactly as it should appear"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  defaultValue={user.phone}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-dltt-green outline-none"
                  placeholder="080..."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Attendance Overview</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[1, 2, 3, 4].map((week) => {
                    const attended = user.attendance?.[`week${week}`];
                    return (
                      <div
                        key={week}
                        className={`rounded-xl border px-4 py-3 text-center text-sm font-medium ${
                          attended
                            ? 'border-green-100 bg-green-50 text-green-700'
                            : 'border-gray-200 bg-gray-50 text-gray-500'
                        }`}
                      >
                        Week {week}: {attended ? 'Present' : 'Pending'}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-dltt-green text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <Modal
        isOpen={submissionModal.isOpen}
        onClose={() => setSubmissionModal({ isOpen: false, materialId: '', title: '' })}
        title={`${submissionModal.submissionId ? 'Update' : 'Submit'}: ${submissionModal.title}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (submissionUrl.trim()) {
              handleSubmitAssignment();
            }
          }}
          className="space-y-4"
        >
          <p className="text-sm text-gray-600">
            Provide a shareable link to your completed assignment, such as Google Drive, Dropbox, or a shared
            document.
          </p>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Submission URL</label>
            <input
              required
              type="url"
              placeholder="https://..."
              className="w-full border border-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-dltt-green outline-none"
              value={submissionUrl}
              onChange={(e) => setSubmissionUrl(e.target.value)}
            />
          </div>
          <div className="flex space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setSubmissionModal({ isOpen: false, materialId: '', title: '' })}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-dltt-green text-white px-4 py-2 rounded-lg font-bold hover:opacity-90"
            >
              {submissionModal.submissionId ? 'Update Submission' : 'Submit Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      {notification && (
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />
      )}
    </div>
  );
}
