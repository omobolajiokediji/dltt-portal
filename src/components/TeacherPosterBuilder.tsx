import React, { useMemo, useRef, useState } from 'react';
import { Camera, Download, ImagePlus, RotateCcw } from 'lucide-react';
import foundationLogo from '../assets/foundation-logo.png?inline';
import { UserProfile } from '../types';

const POSTER_SIZE = 1080;

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toSvgDataUrl(markup: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function splitLongWord(word: string, maxLength: number) {
  const chunks: string[] = [];

  for (let index = 0; index < word.length; index += maxLength) {
    chunks.push(word.slice(index, index + maxLength));
  }

  return chunks;
}

function splitNameForPoster(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ');

  if (normalized.length <= 22) {
    return [normalized];
  }

  const words = normalized
    .split(' ')
    .flatMap((word) => (word.length > 18 ? splitLongWord(word, 18) : word));
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length > 18 && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, 3);
}

function buildTeacherPosterMarkup(displayName: string, teacherState: string, photoDataUrl: string | null) {
  const safeName = escapeSvgText(displayName.trim() || 'Your Name');
  const safeState = escapeSvgText(teacherState.trim() || 'Southwest Nigeria');
  const safeLogo = escapeSvgText(foundationLogo);
  const safePhoto = photoDataUrl ? escapeSvgText(photoDataUrl) : '';
  const nameLines = splitNameForPoster(displayName || 'Your Name');
  const longestNameLine = Math.max(...nameLines.map((line) => line.length));
  const nameFontSize =
    nameLines.length >= 3 ? 25 : longestNameLine > 18 ? 29 : longestNameLine > 14 ? 34 : 43;
  const nameLineHeight = nameFontSize + 5;
  const nameBarTop = 822;
  const nameBarHeight = 114;
  const stateFontSize = 16;
  const nameStateGap = 8;
  const nameBlockHeight = nameFontSize + (nameLines.length - 1) * nameLineHeight + nameStateGap + stateFontSize;
  const nameStartY = nameBarTop + (nameBarHeight - nameBlockHeight) / 2 + nameFontSize * 0.78;
  const stateY = nameStartY + (nameLines.length - 1) * nameLineHeight + nameStateGap + stateFontSize * 0.78;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_SIZE}" height="${POSTER_SIZE}" viewBox="0 0 ${POSTER_SIZE} ${POSTER_SIZE}" role="img" aria-label="DLTT journey poster for ${safeName}">
  <defs>
    <linearGradient id="posterBackground" x1="88" y1="40" x2="998" y2="1040" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0f5f34" />
      <stop offset="0.58" stop-color="#1b8e46" />
      <stop offset="1" stop-color="#d2c72a" />
    </linearGradient>
    <linearGradient id="photoCard" x1="165" y1="325" x2="710" y2="905" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" />
      <stop offset="1" stop-color="#f2faf4" />
    </linearGradient>
    <linearGradient id="namePlate" x1="202" y1="808" x2="650" y2="886" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#146b35" />
      <stop offset="1" stop-color="#1f9d53" />
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="28" stdDeviation="32" flood-color="#073b1f" flood-opacity="0.26" />
    </filter>
    <filter id="monoPhoto">
      <feColorMatrix type="saturate" values="0" />
      <feComponentTransfer>
        <feFuncR type="linear" slope="0.92" intercept="0.06" />
        <feFuncG type="linear" slope="0.92" intercept="0.06" />
        <feFuncB type="linear" slope="0.92" intercept="0.06" />
      </feComponentTransfer>
    </filter>
    <clipPath id="photoClip">
      <rect x="198" y="490" width="424" height="402" rx="12" />
    </clipPath>
  </defs>

  <rect width="${POSTER_SIZE}" height="${POSTER_SIZE}" fill="url(#posterBackground)" />
  <circle cx="960" cy="178" r="170" fill="#f8ec3c" opacity="0.16" />
  <circle cx="68" cy="914" r="210" fill="#f8ec3c" opacity="0.18" />
  <path d="M-48 806 C152 702 222 940 394 820 C508 740 568 754 682 842 C770 910 900 872 1138 734" fill="none" stroke="#f8ec3c" stroke-width="12" stroke-linecap="round" opacity="0.45" />
  <path d="M740 256 C836 196 928 202 1000 278" fill="none" stroke="#f8ec3c" stroke-width="9" stroke-linecap="round" opacity="0.7" />
  <path d="M780 294 C858 252 934 260 996 318" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.42" />
  <path d="M790 596 C916 482 1038 568 1058 714 C1078 852 946 940 826 884 C710 830 688 696 790 596Z" fill="#ffffff" opacity="0.13" />

  <g transform="translate(922 58)">
    <text x="0" y="31" text-anchor="end" font-family="Montserrat, 'Google Sans', Arial, sans-serif" font-size="22" font-weight="900" fill="#ffffff">Odu'a Investment Foundation</text>
    <path d="M-280 45 H0" stroke="#f8ec3c" stroke-width="3" stroke-linecap="round" opacity="0.68" />
    <text x="0" y="68" text-anchor="end" font-family="Montserrat, 'Google Sans', Arial, sans-serif" font-size="17" font-weight="800" fill="#f8ec3c">DEFINED Project</text>
    <rect x="24" y="0" width="78" height="78" rx="22" fill="#ffffff" opacity="0.96" />
    <image href="${safeLogo}" x="32" y="8" width="62" height="62" preserveAspectRatio="xMidYMid meet" />
  </g>

  <g transform="translate(72 168)">
    <text x="0" y="0" font-family="'Segoe Print', 'Comic Sans MS', 'Trebuchet MS', cursive" font-size="52" font-weight="700" fill="#f8ec3c">
      <tspan x="0" dy="0">I just completed my</tspan>
    </text>
    <text x="0" y="72" font-family="Montserrat, 'Google Sans', Arial, sans-serif" font-size="61" font-weight="950" fill="#ffffff">
      <tspan x="0" dy="0">Digital Literacy</tspan>
      <tspan x="0" dy="70">Training</tspan>
    </text>
    <text x="342" y="142" font-family="'Segoe Print', 'Comic Sans MS', 'Trebuchet MS', cursive" font-size="66" font-weight="700" fill="#f8ec3c" transform="rotate(-4 342 142)">journey</text>
    <rect x="0" y="176" width="304" height="48" rx="24" fill="#111827" opacity="0.78" />
    <text x="152" y="207" text-anchor="middle" font-family="Montserrat, 'Google Sans', Arial, sans-serif" font-size="20" font-weight="900" fill="#ffffff">with the DLTT Program</text>
  </g>

  <g filter="url(#softShadow)">
    <rect x="146" y="396" width="520" height="600" rx="42" fill="url(#photoCard)" />
    <circle cx="206" cy="452" r="23" fill="#111827" />
    <circle cx="206" cy="444" r="8" fill="#ffffff" />
    <path d="M190 468 C193 457 198 452 206 452 C214 452 219 457 222 468Z" fill="#ffffff" />
    <text x="242" y="447" font-family="Montserrat, 'Google Sans', Arial, sans-serif" font-size="21" font-weight="900" fill="#111827">DLTT Program</text>
    <text x="242" y="472" font-family="Montserrat, 'Google Sans', Arial, sans-serif" font-size="15" font-weight="700" fill="#6b7280">Southwest Nigeria</text>
    <rect x="198" y="490" width="424" height="402" rx="12" fill="#e5e7eb" />
    ${
      safePhoto
        ? `<image href="${safePhoto}" x="198" y="490" width="424" height="402" preserveAspectRatio="xMidYMid slice" clip-path="url(#photoClip)" filter="url(#monoPhoto)" />`
        : `<g transform="translate(198 490)">
      <rect width="424" height="402" rx="12" fill="#e8f5e9" />
      <circle cx="212" cy="144" r="72" fill="#c8e6cf" />
      <path d="M100 354 C120 262 166 226 212 226 C258 226 304 262 324 354Z" fill="#b7dcc3" />
      <text x="212" y="374" text-anchor="middle" font-family="Montserrat, 'Google Sans', Arial, sans-serif" font-size="22" font-weight="800" fill="#1b8e46">Upload your photo</text>
    </g>`
    }
    <path d="M198 822 H646 V936 H198 C216 902 216 856 198 822Z" fill="url(#namePlate)" />
    <path d="M226 820 C312 800 500 804 620 822" fill="none" stroke="#f8ec3c" stroke-width="5" stroke-linecap="round" opacity="0.82" />
    <text x="422" y="${nameStartY.toFixed(1)}" text-anchor="middle" font-family="Montserrat, 'Google Sans', Arial, sans-serif" font-size="${nameFontSize}" font-weight="900" fill="#ffffff">
      ${nameLines
        .map((line, index) => `<tspan x="422" dy="${index === 0 ? 0 : nameLineHeight}">${escapeSvgText(line)}</tspan>`)
        .join('')}
    </text>
    <text x="422" y="${stateY.toFixed(1)}" text-anchor="middle" font-family="Montserrat, 'Google Sans', Arial, sans-serif" font-size="${stateFontSize}" font-weight="700" fill="#dff6e7" opacity="0.72">${safeState}</text>
  </g>

  <g transform="translate(704 594)">
    <text x="0" y="0" font-family="Montserrat, 'Google Sans', Arial, sans-serif" font-size="31" font-weight="900" fill="#ffffff">
      <tspan x="0" dy="0">Building digital</tspan>
      <tspan x="0" dy="42">confidence for</tspan>
    </text>
    <text x="0" y="98" font-family="'Segoe Print', 'Comic Sans MS', 'Trebuchet MS', cursive" font-size="38" font-weight="700" fill="#f8ec3c">
      <tspan x="0" dy="0">today's classroom.</tspan>
    </text>
    <rect x="0" y="140" width="238" height="58" rx="29" fill="#111827" opacity="0.88" />
    <g transform="translate(22 156)" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="13" cy="13" r="12" />
      <path d="M1 13 H25" />
      <path d="M13 1 C18 7 18 19 13 25" />
      <path d="M13 1 C8 7 8 19 13 25" />
    </g>
    <text x="142" y="177" text-anchor="middle" font-family="Montserrat, 'Google Sans', Arial, sans-serif" font-size="20" font-weight="900" fill="#ffffff">dltt.odif.ng</text>
  </g>

  <text x="72" y="1020" font-family="Montserrat, 'Google Sans', Arial, sans-serif" font-size="22" font-weight="800" fill="#ffffff" opacity="0.22">Odu'a Investment Foundation</text>
  <text x="1012" y="1030" text-anchor="end" font-family="Montserrat, 'Google Sans', Arial, sans-serif" font-size="68" font-weight="950" fill="#ffffff" opacity="0.18">#DLTT</text>
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

async function downloadPosterPng(markup: string, displayName: string) {
  const svgBlob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement('canvas');
    canvas.width = POSTER_SIZE;
    canvas.height = POSTER_SIZE;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not prepare poster canvas.');
    }

    context.drawImage(image, 0, 0, POSTER_SIZE, POSTER_SIZE);

    const anchor = document.createElement('a');
    const safeName = (displayName || 'dltt-teacher').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
    anchor.href = canvas.toDataURL('image/png');
    anchor.download = `${safeName.toLowerCase()}-dltt-poster.png`;
    anchor.click();
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export default function TeacherPosterBuilder({ user }: { user: UserProfile }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [displayName, setDisplayName] = useState(user.certificateName || user.name);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(user.profilePhoto || null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const posterMarkup = useMemo(
    () => buildTeacherPosterMarkup(displayName, user.state, photoDataUrl),
    [displayName, photoDataUrl, user.state],
  );
  const posterPreviewUrl = useMemo(() => toSvgDataUrl(posterMarkup), [posterMarkup]);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setStatusMessage('Please choose a valid image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(String(reader.result || ''));
      setStatusMessage(null);
    };
    reader.onerror = () => setStatusMessage('Could not load that photo. Please try another one.');
    reader.readAsDataURL(file);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setStatusMessage(null);

    try {
      await downloadPosterPng(posterMarkup, displayName);
    } catch (error) {
      setStatusMessage('Could not generate the poster image. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-8 items-start">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-dltt-green">Social Poster</p>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">Create your DLTT journey card</h2>
          <p className="mt-2 text-sm text-gray-600">
            Add your photo and name, then download a square image ready for WhatsApp, Instagram, Facebook, or LinkedIn.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-dltt-green outline-none"
            placeholder="Enter your name"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-bold text-gray-700">Photo</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-dltt-green px-4 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity"
            >
              <ImagePlus size={18} />
              Upload Photo
            </button>
            <button
              type="button"
              onClick={() => {
                setPhotoDataUrl(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <RotateCcw size={18} />
              Reset Photo
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800">
          The image is generated in your browser. Uploaded photos are not saved to the portal.
        </div>

        {statusMessage && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {statusMessage}
          </div>
        )}

        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 font-bold text-white hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          <Download size={19} />
          {isDownloading ? 'Preparing Image...' : 'Download PNG'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Preview</h3>
            <p className="text-sm text-gray-500">Square 1080 x 1080 image</p>
          </div>
          <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-dltt-light text-dltt-green">
            <Camera size={20} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-[640px] overflow-hidden rounded-xl border border-gray-100 bg-gray-100 shadow-sm">
          <img src={posterPreviewUrl} alt="DLTT poster preview" className="block aspect-square w-full object-cover" />
        </div>
      </div>
    </div>
  );
}
