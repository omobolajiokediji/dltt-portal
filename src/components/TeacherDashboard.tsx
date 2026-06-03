import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import {
  AlertCircle,
  AudioWaveform,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Pencil,
  Trophy,
  Users,
  Video,
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import foundationLogo from '../assets/foundation-logo.png?inline';
import signature1 from '../assets/signature1.png?inline';
import signature2 from '../assets/signature2.png?inline';
import { AssignmentSubmission, LearningMaterial, PortalSettings, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import { sortMaterialsByNewest } from '../lib/materials';
import { getTeacherProfileEditingDisabled, subscribeToPortalSettings } from '../lib/portalSettings';
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
  const issuedDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const safeName = escapeSvgText(certificateName);
  const safeDate = escapeSvgText(issuedDate);
  const nameFontSize = certificateName.length > 34 ? 54 : certificateName.length > 26 ? 62 : 72;
  const logoUrl = escapeSvgText(foundationLogo);
  const leftSignatureUrl = escapeSvgText(signature2);
  const rightSignatureUrl = escapeSvgText(signature1);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="990" viewBox="0 0 1400 990" role="img" aria-label="DLTT certificate for ${safeName}">
  <defs>
    <linearGradient id="certificateBorder" x1="85" y1="80" x2="1315" y2="910" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#15924a" />
      <stop offset="1" stop-color="#d8d91f" />
    </linearGradient>
    <linearGradient id="sealGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff4a8" />
      <stop offset="0.35" stop-color="#d9a51f" />
      <stop offset="0.7" stop-color="#fff2a6" />
      <stop offset="1" stop-color="#b67814" />
    </linearGradient>
    <filter id="certificateShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#073b1f" flood-opacity="0.12" />
    </filter>
  </defs>

  <rect width="1400" height="990" fill="#f8faf7" />
  <rect x="88" y="55" width="1224" height="880" rx="42" fill="#ffffff" filter="url(#certificateShadow)" />
  <rect x="112" y="80" width="1176" height="830" rx="34" fill="none" stroke="url(#certificateBorder)" stroke-width="6" />

  <image href="${logoUrl}" x="178" y="106" width="120" height="120" preserveAspectRatio="xMidYMid meet" />

  <text x="700" y="172" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="82" font-weight="700" letter-spacing="10" fill="#168747">CERTIFICATE</text>
  <text x="700" y="230" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="38" font-weight="700" letter-spacing="6" fill="#168747">OF COMPLETION</text>

  <text x="700" y="322" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" letter-spacing="4" fill="#0b3f22">THIS IS TO CERTIFY THAT</text>
  <text x="700" y="432" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${nameFontSize}" font-weight="700" fill="#0b3f22">${safeName}</text>
  <line x1="225" y1="454" x2="1175" y2="454" stroke="#0b3f22" stroke-width="3" />
  <circle cx="225" cy="454" r="4" fill="#ffffff" stroke="#0b3f22" stroke-width="3" />
  <circle cx="1175" cy="454" r="4" fill="#ffffff" stroke="#0b3f22" stroke-width="3" />

  <text x="700" y="530" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="28" letter-spacing="3" fill="#0b3f22">
    <tspan>has successfully completed the </tspan>
    <tspan font-weight="700">Digital Literacy Training for</tspan>
  </text>
  <text x="700" y="570" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="28" letter-spacing="3" fill="#0b3f22">
    <tspan font-weight="700">Teachers (DLTT)</tspan>
    <tspan> programme and is hereby acknowledged for</tspan>
  </text>
  <text x="700" y="610" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="28" letter-spacing="3" fill="#0b3f22">dedication, skill development, and excellence.</text>

  <g transform="translate(700 710)">
    <polygon points="0,-58 15,-18 58,-18 24,6 37,48 0,22 -37,48 -24,6 -58,-18 -15,-18" fill="url(#sealGold)" stroke="#c58a16" stroke-width="3" />
    <circle cx="0" cy="0" r="37" fill="#fff3a5" stroke="#c58a16" stroke-width="4" />
    <path d="M -58 58 C -34 34, -12 34, 0 60 C 12 34, 34 34, 58 58 L 35 92 L 0 70 L -35 92 Z" fill="url(#sealGold)" stroke="#c58a16" stroke-width="3" />
  </g>

  <g>
    <line x1="205" y1="742" x2="510" y2="742" stroke="#d9c897" stroke-width="2" />
    <image href="${leftSignatureUrl}" x="238" y="656" width="250" height="88" preserveAspectRatio="xMidYMid meet" />
    <text x="358" y="790" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="700" fill="#0b3f22">Prof. Seun Kolade</text>
    <text x="358" y="822" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" letter-spacing="1.5" fill="#334155">Project Director, DEFINED Project</text>
  </g>

  <g>
    <line x1="890" y1="742" x2="1195" y2="742" stroke="#d9c897" stroke-width="2" />
    <image href="${rightSignatureUrl}" x="918" y="656" width="250" height="88" preserveAspectRatio="xMidYMid meet" />
    <text x="1042" y="790" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="700" fill="#0b3f22">Mrs. Abiola Ajayi</text>
    <text x="1042" y="822" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" letter-spacing="1.2" fill="#334155">Ag. Executive Secretary,</text>
    <text x="1042" y="846" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" letter-spacing="1.2" fill="#334155">Odu'a Investment Foundation</text>
  </g>

  <text x="700" y="875" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="24" letter-spacing="3" fill="#0b3f22">Issued on: <tspan font-weight="700">${safeDate}</tspan></text>
</svg>`;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function renderCertificatePdf(certificateMarkup: string) {
  const svgBlob = new Blob([certificateMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = 2800;
    canvas.height = 1980;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not prepare certificate canvas.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const jpegBytes = dataUrlToBytes(jpegDataUrl);

    return buildSingleImagePdf(jpegBytes, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function buildSingleImagePdf(imageBytes: Uint8Array, imageWidth: number, imageHeight: number) {
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 18;
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;
  const scale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const drawX = (pageWidth - drawWidth) / 2;
  const drawY = (pageHeight - drawHeight) / 2;
  const content = `q\n${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm\n/Im0 Do\nQ`;
  const textEncoder = new TextEncoder();
  const objects: Uint8Array[] = [
    textEncoder.encode('<< /Type /Catalog /Pages 2 0 R >>'),
    textEncoder.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    textEncoder.encode(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    ),
    concatBytes([
      textEncoder.encode(
        `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
      ),
      imageBytes,
      textEncoder.encode('\nendstream'),
    ]),
    textEncoder.encode(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
  ];

  return writePdf(objects);
}

function writePdf(objects: Uint8Array[]) {
  const textEncoder = new TextEncoder();
  const chunks: Uint8Array[] = [textEncoder.encode('%PDF-1.4\n')];
  const offsets: number[] = [0];
  let byteLength = chunks[0].length;

  objects.forEach((object, index) => {
    offsets.push(byteLength);
    const header = textEncoder.encode(`${index + 1} 0 obj\n`);
    const footer = textEncoder.encode('\nendobj\n');
    chunks.push(header, object, footer);
    byteLength += header.length + object.length + footer.length;
  });

  const xrefOffset = byteLength;
  const xrefRows = offsets
    .map((offset, index) => (index === 0 ? '0000000000 65535 f ' : `${String(offset).padStart(10, '0')} 00000 n `))
    .join('\n');
  const trailer = `xref\n0 ${objects.length + 1}\n${xrefRows}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  chunks.push(textEncoder.encode(trailer));

  return new Blob(chunks, { type: 'application/pdf' });
}

function concatBytes(parts: Uint8Array[]) {
  const byteLength = parts.reduce((total, part) => total + part.length, 0);
  const bytes = new Uint8Array(byteLength);
  let offset = 0;

  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }

  return bytes;
}

function getWeeklyTestScoreLabel(materialId: string) {
  const match = materialId.match(/^test-assessment-week-(\d+)$/);
  return match ? `Week ${match[1]} Test Score` : null;
}

export default function TeacherDashboard({ user }: { user: UserProfile }) {
  const [materials, setMaterials] = useState<LearningMaterial[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [portalSettings, setPortalSettings] = useState<PortalSettings>({ teacherProfileEditingDisabled: false });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'materials' | 'assignments' | 'certificate' | 'profile'>('materials');
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
  const [submissionModal, setSubmissionModal] = useState<SubmissionModalState>({
    isOpen: false,
    materialId: '',
    title: '',
  });
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));

  const toggleWeekExpanded = (week: number) => {
    const newExpandedWeeks = new Set(expandedWeeks);
    if (newExpandedWeeks.has(week)) {
      newExpandedWeeks.delete(week);
    } else {
      newExpandedWeeks.add(week);
    }
    setExpandedWeeks(newExpandedWeeks);
  };

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

        const filteredMaterials = allMaterials.filter((material) => isMaterialAssignedToUser(material, user));

        setMaterials(sortMaterialsByNewest(filteredMaterials));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'materials'),
    );

    const unsubSubmissions = onSnapshot(
      submissionsQuery,
      (snapshot) => {
        const teacherSubmissions = snapshot.docs
          .map((submissionDoc) => ({ id: submissionDoc.id, ...submissionDoc.data() }) as AssignmentSubmission)
          .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));

        setSubmissions(teacherSubmissions);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'submissions'),
    );

    const unsubPortalStats = subscribeToPortalSettings(
      db,
      setPortalSettings,
      (error) => handleFirestoreError(error, OperationType.LIST, 'portal settings'),
    );

    return () => {
      unsubMaterials();
      unsubSubmissions();
      unsubPortalStats();
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
  const certificateMarkup = useMemo(() => buildCertificateMarkup(user), [user]);
  const isProfileEditingDisabled = getTeacherProfileEditingDisabled(portalSettings);
  const editableProfileFieldClass = `w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-dltt-green outline-none ${
    isProfileEditingDisabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
  }`;
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
    if (isProfileEditingDisabled) {
      setNotification({ message: 'Profile editing is currently disabled. Contact Admin.', type: 'error' });
      return;
    }

    const formData = new FormData(e.currentTarget);
    const certificateName = String(formData.get('certName') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const gender = String(formData.get('gender') || '').trim() || undefined;
    const school = String(formData.get('school') || '').trim() || undefined;
    const state = String(formData.get('state') || '').trim();
    const accountNumber = String(formData.get('accountNumber') || '').trim() || undefined;
    const bank = String(formData.get('bank') || '').trim() || undefined;
    const accountName = String(formData.get('accountName') || '').trim() || undefined;

    if (
      !certificateName ||
      !phone ||
      !gender ||
      !school ||
      !state ||
      !accountNumber ||
      !bank ||
      !accountName
    ) {
      setNotification({ message: 'Please complete all profile fields before saving.', type: 'error' });
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        certificateName,
        phone,
        gender,
        school,
        state,
        accountNumber,
        bank,
        accountName,
      });
      setNotification({ message: 'Profile updated successfully.', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleCertificateDownload = async () => {
    try {
      const pdfBlob = await renderCertificatePdf(certificateMarkup);
      const objectUrl = URL.createObjectURL(pdfBlob);
      const anchor = document.createElement('a');
      const safeName = (user.certificateName || user.name || 'dltt-certificate').replace(/[^a-z0-9]+/gi, '-');

      anchor.href = objectUrl;
      anchor.download = `${safeName.toLowerCase()}-dltt-certificate.pdf`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setNotification({ message: 'Could not generate the certificate PDF. Please try again.', type: 'error' });
    }
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
                <p className="text-sm text-gray-500">Training Completion</p>
                <p className="text-2xl font-bold text-gray-900">
                  {progress.completionRate}%
                </p>
                <p className="text-xs text-gray-500">
                  {progress.submittedAssignments}/{progress.totalAssignments} assignments · {progress.completedWeeklyTests}/{progress.totalWeeklyTests} tests
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
              <div key={week} className="space-y-3">
                <button
                  onClick={() => toggleWeekExpanded(week)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all"
                >
                  <h2 className="text-lg font-bold text-gray-800 flex items-center space-x-3">
                    <span className="bg-dltt-green text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold">
                      W{week}
                    </span>
                    <span>Week {week} Materials</span>
                  </h2>
                  <motion.div
                    animate={{ rotate: expandedWeeks.has(week) ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={20} className="text-gray-600" />
                  </motion.div>
                </button>

                {expandedWeeks.has(week) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  >
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
                              {material.type === 'assignment' ? (
                                <FileText size={20} />
                              ) : material.type === 'video' ? (
                                <Video size={20} />
                              ) : material.type === 'audio' ? (
                                <AudioWaveform size={20} />
                              ) : (
                                <BookOpen size={20} />
                              )}
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
                  </motion.div>
                )}
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
                  const weeklyTestScoreLabel = getWeeklyTestScoreLabel(submission.materialId);
                  const isLatestSubmission = latestSubmissionByMaterial.get(submission.materialId)?.id === submission.id;
                  const canEdit = submission.status === 'pending' && isLatestSubmission && material;

                  return (
                    <tr key={submission.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{material?.title || weeklyTestScoreLabel || 'Unknown Assignment'}</p>
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
                <div
                  className="w-full max-w-4xl overflow-hidden rounded-xl border border-gray-100 bg-gray-50 shadow-sm [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: certificateMarkup }}
                />
                <button
                  onClick={handleCertificateDownload}
                  className="bg-dltt-green text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg shadow-green-200"
                >
                  Download Certificate PDF
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
                      Weekly tests completed: {progress.completedWeeklyTests}/{progress.totalWeeklyTests}
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
            {isProfileEditingDisabled && (
              <div className="mb-6 rounded-xl border border-yellow-100 bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800">
                Profile editing is currently disabled. Contact Admin.
              </div>
            )}
            <form className="space-y-6" onSubmit={handleProfileUpdate}>
              <fieldset disabled={isProfileEditingDisabled} className="space-y-6 disabled:opacity-75">
                <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Full Name (for Certificate)</label>
                <input
                  required
                  type="text"
                  name="certName"
                  defaultValue={user.certificateName || user.name}
                  className={editableProfileFieldClass}
                  placeholder="Enter your name exactly as it should appear"
                />
                </div>
                <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number</label>
                <input
                  required
                  type="tel"
                  name="phone"
                  readOnly
                  defaultValue={user.phone}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-dltt-green outline-none"
                  placeholder="080..."
                />
                </div>
                <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Gender</label>
                <select
                  required
                  name="gender"
                  defaultValue={user.gender || ''}
                  className={editableProfileFieldClass}
                >
                  <option value="" disabled>Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                </div>
                <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">School/Institution</label>
                <input
                  required
                  type="text"
                  name="school"
                  defaultValue={user.school || ''}
                  className={editableProfileFieldClass}
                  placeholder="Enter your school name"
                />
                </div>
                <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">State</label>
                <input
                  required
                  type="text"
                  name="state"
                  defaultValue={user.state || ''}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-500 outline-none"
                  placeholder="Enter your state"
                  readOnly
                />
                </div>
                <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Account Number</label>
                <input
                  required
                  type="text"
                  name="accountNumber"
                  defaultValue={user.accountNumber || ''}
                  className={editableProfileFieldClass}
                  placeholder="Enter your account number"
                />
                </div>
                <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Bank Name</label>
                <input
                  required
                  type="text"
                  name="bank"
                  defaultValue={user.bank || ''}
                  className={editableProfileFieldClass}
                  placeholder="Enter your bank name"
                />
                </div>
                <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Account Name</label>
                <input
                  required
                  type="text"
                  name="accountName"
                  defaultValue={user.accountName || ''}
                  className={editableProfileFieldClass}
                  placeholder="Enter your account name"
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
              </fieldset>
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isProfileEditingDisabled}
                  className="w-full bg-dltt-green text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                >
                  {isProfileEditingDisabled ? 'Profile Editing Disabled' : 'Save Profile Changes'}
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
