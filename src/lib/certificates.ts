import foundationLogo from '../assets/foundation-logo.png?inline';
import signature1 from '../assets/signature1.png?inline';
import signature2 from '../assets/signature2.png?inline';
import { GrowthRole, UserProfile } from '../types';

export const certificateLevelOrder: GrowthRole[] = ['teacher', 'trainer', 'master-trainer', 'pro-trainer'];

export const certificateLevelLabels: Record<GrowthRole, string> = {
  teacher: 'Teacher',
  trainer: 'Trainer',
  'master-trainer': 'Master Trainer',
  'pro-trainer': 'Pro Trainer',
};

const certificateLevelCopy: Record<GrowthRole, { heading: string; lineOne: string; lineTwo: string; lineThree: string }> = {
  teacher: {
    heading: 'Teacher',
    lineOne: 'has successfully completed the foundational Teacher Level of the',
    lineTwo: 'Digital Literacy Training for Teachers (DLTT) Program',
    lineThree: 'and is recognized for digital readiness, commitment, and professional growth.',
  },
  trainer: {
    heading: 'Trainer',
    lineOne: 'has successfully completed the Trainer Level of the',
    lineTwo: 'Digital Literacy Training for Teachers (DLTT) Program',
    lineThree: 'and is recognized for mentoring teachers, guiding learning activities, and demonstrated leadership.',
  },
  'master-trainer': {
    heading: 'Master Trainer',
    lineOne: 'has successfully completed the Master Trainer Level of the',
    lineTwo: 'Digital Literacy Training for Teachers (DLTT) Program',
    lineThree: 'and is recognized for advanced facilitation, cohort leadership, and sustained training excellence.',
  },
  'pro-trainer': {
    heading: 'Pro Trainer',
    lineOne: 'has successfully completed the Pro Trainer Level of the',
    lineTwo: 'Digital Literacy Training for Teachers (DLTT) Program',
    lineThree: 'and is recognized for exemplary leadership, scalable impact, and outstanding professional achievement.',
  },
};

export function getCurrentGrowthRole(user: UserProfile): GrowthRole {
  return certificateLevelOrder.includes(user.role as GrowthRole) ? (user.role as GrowthRole) : 'teacher';
}

export function getCertificateLevelsForUser(user: UserProfile) {
  const currentIndex = certificateLevelOrder.indexOf(getCurrentGrowthRole(user));
  return certificateLevelOrder.slice(0, currentIndex + 1);
}

export function isCertificationApproved(user: UserProfile, level: GrowthRole) {
  return !!user.certifications?.[level]?.approved || (level === 'teacher' && !!user.approvedForCertificate);
}

export function getCertificationApprovedAt(user: UserProfile, level: GrowthRole) {
  return user.certifications?.[level]?.approvedAt;
}

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildCertificateMarkup(user: UserProfile, level: GrowthRole = 'teacher') {
  const certificateName = user.certificateName?.trim() || user.name;
  const issuedDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const levelLabel = certificateLevelLabels[level];
  const levelCopy = certificateLevelCopy[level];
  const safeName = escapeSvgText(certificateName);
  const safeDate = escapeSvgText(issuedDate);
  const safeLevel = escapeSvgText(levelLabel);
  const safeLevelHeading = escapeSvgText(levelCopy.heading);
  const safeLineOne = escapeSvgText(levelCopy.lineOne);
  const safeLineTwo = escapeSvgText(levelCopy.lineTwo);
  const safeLineThree = escapeSvgText(levelCopy.lineThree);
  const nameFontSize = certificateName.length > 34 ? 54 : certificateName.length > 26 ? 62 : 72;
  const achievementFontSize = level === 'trainer' ? 26 : 25;
  const logoUrl = escapeSvgText(foundationLogo);
  const leftSignatureUrl = escapeSvgText(signature2);
  const rightSignatureUrl = escapeSvgText(signature1);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="990" viewBox="0 0 1400 990" role="img" aria-label="DLTT ${safeLevel} certificate for ${safeName}">
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

  <text x="700" y="506" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="21" font-weight="700" letter-spacing="4" fill="#168747">${safeLevelHeading}</text>
  <line x1="510" y1="526" x2="890" y2="526" stroke="#d9c897" stroke-width="2" />
  <text x="700" y="570" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${achievementFontSize}" letter-spacing="2.2" fill="#0b3f22">
    <tspan>${safeLineOne}</tspan>
  </text>
  <text x="700" y="612" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${achievementFontSize}" font-weight="700" letter-spacing="2.2" fill="#0b3f22">
    <tspan>${safeLineTwo}</tspan>
  </text>
  <text x="700" y="654" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" letter-spacing="1.8" fill="#0b3f22">${safeLineThree}</text>

  <g transform="translate(700 724)">
    <polygon points="0,-58 15,-18 58,-18 24,6 37,48 0,22 -37,48 -24,6 -58,-18 -15,-18" fill="url(#sealGold)" stroke="#c58a16" stroke-width="3" />
    <circle cx="0" cy="0" r="37" fill="#fff3a5" stroke="#c58a16" stroke-width="4" />
    <path d="M -58 58 C -34 34, -12 34, 0 60 C 12 34, 34 34, 58 58 L 35 92 L 0 70 L -35 92 Z" fill="url(#sealGold)" stroke="#c58a16" stroke-width="3" />
  </g>

  <g>
    <line x1="205" y1="742" x2="510" y2="742" stroke="#d9c897" stroke-width="2" />
    <image href="${leftSignatureUrl}" x="238" y="668" width="250" height="88" preserveAspectRatio="xMidYMid meet" />
    <text x="358" y="790" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="700" fill="#0b3f22">Prof. Seun Kolade</text>
    <text x="358" y="822" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" letter-spacing="1.5" fill="#334155">Project Director, DEFINED Project</text>
  </g>

  <g>
    <line x1="890" y1="742" x2="1195" y2="742" stroke="#d9c897" stroke-width="2" />
    <image href="${rightSignatureUrl}" x="918" y="668" width="250" height="88" preserveAspectRatio="xMidYMid meet" />
    <text x="1042" y="790" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-weight="700" fill="#0b3f22">Mrs. Abiola Ajayi</text>
    <text x="1042" y="822" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" letter-spacing="1.2" fill="#334155">Ag. Executive Secretary,</text>
    <text x="1042" y="846" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" letter-spacing="1.2" fill="#334155">Odu'a Investment Foundation</text>
  </g>

  <text x="700" y="875" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="24" letter-spacing="3" fill="#0b3f22">Issued on: <tspan font-weight="700">${safeDate}</tspan></text>
</svg>`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
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

function concatBytes(parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
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

export async function renderCertificatePdf(certificateMarkup: string) {
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

export async function downloadCertificatePdf(user: UserProfile, level: GrowthRole) {
  const certificateMarkup = buildCertificateMarkup(user, level);
  const pdfBlob = await renderCertificatePdf(certificateMarkup);
  const safeName = (user.certificateName || user.name || 'dltt-certificate').replace(/[^a-z0-9]+/gi, '-');
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(pdfBlob);
  anchor.download = `${safeName.toLowerCase()}-${level}-dltt-certificate.pdf`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}
