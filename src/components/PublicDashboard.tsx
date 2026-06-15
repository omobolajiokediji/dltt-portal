import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GenderDistributionItem, StateGrowthStats, TrainingStats } from '../types';
import { CheckCircle, Users, Map, Trophy, UserCheck, Medal, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

function getPiePath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const startX = cx + radius * Math.cos(startAngle);
  const startY = cy + radius * Math.sin(startAngle);
  const endX = cx + radius * Math.cos(endAngle);
  const endY = cy + radius * Math.sin(endAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1;
  return `M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
}

function GenderPieChart({
  data,
  onSliceHover,
  onSliceLeave,
}: {
  data: GenderDistributionItem[];
  onSliceHover: (item: GenderDistributionItem) => void;
  onSliceLeave: () => void;
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let currentAngle = -Math.PI / 2;

  return (
    <svg viewBox="0 0 260 260" className="mx-auto block max-w-[280px]">
      <circle cx="130" cy="130" r="90" fill="#f3f4f6" />
      {data.map((item, index) => {
        const sliceAngle = total > 0 ? (item.count / total) * Math.PI * 2 : 0;
        const startAngle = currentAngle;
        const endAngle = currentAngle + sliceAngle;
        const path = sliceAngle > 0 ? getPiePath(130, 130, 90, startAngle, endAngle) : '';
        currentAngle = endAngle;

        return (
          <path
            key={item.label}
            d={path}
            fill={item.color}
            stroke="#ffffff"
            strokeWidth="2"
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => onSliceHover(item)}
            onMouseLeave={() => onSliceLeave()}
          />
        );
      })}
      <circle cx="130" cy="130" r="50" fill="#ffffff" />
      <text x="130" y="126" textAnchor="middle" fontSize="18" fontWeight="700" fill="#111827">
        {total}
      </text>
      <text x="130" y="148" textAnchor="middle" fontSize="12" fill="#6b7280">
        Teachers
      </text>
    </svg>
  );
}

const southwestMapShapes = [
  {
    state: 'Oyo State',
    shortName: 'OYO',
    city: 'Ibadan',
    path: 'M126 63 C157 50 167 12 196 24 C221 34 216 53 248 66 C282 80 293 113 328 105 C356 97 382 103 371 132 C361 157 335 162 343 190 C353 221 348 257 319 280 C284 307 244 293 220 317 C202 337 176 315 151 321 C122 326 116 291 91 292 C66 293 65 265 73 247 C81 229 58 211 70 193 C82 176 60 158 78 139 C98 118 96 88 126 63 Z',
    labelX: 210,
    labelY: 160,
    cityX: 176,
    cityY: 194,
  },
  {
    state: 'Osun State',
    shortName: 'OSUN',
    city: 'Osogbo',
    path: 'M328 112 C363 115 391 119 410 151 C436 148 464 158 470 192 C477 225 447 241 445 273 C443 301 415 319 386 309 C363 330 331 311 308 295 C282 303 260 281 270 253 C280 226 258 201 282 184 C302 169 292 135 328 112 Z',
    labelX: 372,
    labelY: 204,
    cityX: 358,
    cityY: 232,
  },
  {
    state: 'Ekiti State',
    shortName: 'EKITI',
    city: 'Ado Ekiti',
    path: 'M461 120 C500 111 526 133 557 136 C585 139 613 150 608 184 C631 201 621 226 597 237 C602 268 577 292 548 285 C526 309 499 292 481 275 C463 260 439 275 425 253 C410 229 441 212 433 190 C424 163 445 139 461 120 Z',
    labelX: 522,
    labelY: 190,
    cityX: 506,
    cityY: 220,
  },
  {
    state: 'Ogun State',
    shortName: 'OGUN',
    city: 'Abeokuta',
    path: 'M73 282 C101 270 112 296 129 313 C145 332 174 323 195 340 C225 365 264 337 293 361 L360 412 L335 479 L216 459 C168 458 139 477 96 462 L48 472 L61 393 C70 352 50 314 73 282 Z',
    labelX: 168,
    labelY: 376,
    cityX: 146,
    cityY: 410,
  },
  {
    state: 'Lagos State',
    shortName: 'LAGOS',
    city: 'Ikeja',
    path: 'M40 464 L146 454 C190 450 238 451 282 464 C319 473 350 475 371 464 L374 497 C317 505 276 494 222 490 C160 486 101 499 42 493 Z',
    labelX: 214,
    labelY: 482,
    cityX: 184,
    cityY: 506,
  },
  {
    state: 'Ondo State',
    shortName: 'ONDO',
    city: 'Akure',
    path: 'M407 300 C437 278 469 284 493 299 C523 288 546 308 548 341 C583 350 583 386 558 406 C559 449 531 492 496 502 C469 512 469 558 429 535 C393 514 365 490 330 488 C300 485 292 454 318 436 C349 414 341 376 360 347 C372 326 383 313 407 300 Z',
    labelX: 454,
    labelY: 378,
    cityX: 444,
    cityY: 410,
  },
];

function getStateGrowthValue(data: StateGrowthStats[], state: string) {
  return data.find((item) => item.state === state) || {
    state,
    teachers: 0,
    trainers: 0,
    seniorTrainers: 0,
    masterTrainers: 0,
    total: 0,
  };
}

function SouthwestGrowthMap({
  data,
  selectedState,
  onSelectState,
}: {
  data: StateGrowthStats[];
  selectedState: string;
  onSelectState: (state: string) => void;
}) {
  const maxTotal = Math.max(1, ...data.map((item) => item.total));
  const selected = getStateGrowthValue(data, selectedState || data[0]?.state || 'Oyo State');
  const leadershipTotal = selected.trainers + selected.seniorTrainers + selected.masterTrainers;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-full"
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Southwest Growth Map</h2>
          <p className="text-sm text-gray-500">Live teacher and trainer spread by state.</p>
        </div>
        <Map className="text-dltt-green" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.8fr)_minmax(280px,0.45fr)] gap-6 items-center">
        <div className="rounded-2xl bg-green-50/60 border border-green-100 p-3">
          <svg viewBox="0 0 660 560" className="mx-auto block w-full max-w-[760px] h-auto" role="img" aria-label="Southwest Nigeria growth map">
            <rect x="0" y="0" width="660" height="560" rx="28" fill="#f0fdf4" />
            <path d="M42 486 C122 474 194 478 266 490 C323 500 368 512 416 504 C472 494 524 468 586 430" fill="none" stroke="#38bdf8" strokeWidth="10" strokeLinecap="round" opacity="0.7" />
            <path d="M46 500 C118 492 192 494 278 506 C353 518 424 522 508 482" fill="none" stroke="#bae6fd" strokeWidth="4" strokeLinecap="round" opacity="0.75" />
            {southwestMapShapes.map((shape) => {
              const stateData = getStateGrowthValue(data, shape.state);
              const intensity = stateData.total / maxTotal;
              const isSelected = selected.state === shape.state;
              const fill = intensity > 0.75 ? '#04783f' : intensity > 0.45 ? '#22a34a' : intensity > 0 ? '#97d845' : '#c8e87a';

              return (
                <g key={shape.state}>
                  <path
                    d={shape.path}
                    fill={fill}
                    stroke={isSelected ? '#f8ec3c' : '#ffffff'}
                    strokeWidth={isSelected ? 7 : 4.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    filter="drop-shadow(0 12px 14px rgba(0,0,0,0.35))"
                    className="cursor-pointer transition-opacity hover:opacity-90"
                    onClick={() => onSelectState(shape.state)}
                  />
                  <text x={shape.labelX} y={shape.labelY} textAnchor="middle" fontSize="25" fontWeight="900" fill="#064e3b">
                    {shape.shortName}
                  </text>
                  <g transform={`translate(${shape.cityX} ${shape.cityY})`}>
                    <circle cx="0" cy="0" r="7" fill="#111827" stroke="#ffffff" strokeWidth="3" />
                    <text x="15" y="6" fontSize="14" fontWeight="800" fill="#111827">
                      {shape.city}
                    </text>
                  </g>
                  <g transform={`translate(${shape.labelX + 54} ${shape.labelY - 36})`}>
                    <rect x="-25" y="-16" width="50" height="32" rx="16" fill="#ffffff" opacity="0.95" />
                    <text x="0" y="6" textAnchor="middle" fontSize="15" fontWeight="900" fill="#0f5132">
                      {stateData.total}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Selected State</p>
            <h3 className="text-lg font-bold text-gray-900 mt-1">{selected.state}</h3>
            <p className="text-sm text-gray-500 mt-1">{selected.total} total participant{selected.total === 1 ? '' : 's'}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-gray-500">Teachers</p>
              <p className="text-xl font-bold text-blue-700">{selected.teachers}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-gray-500">Trainers</p>
              <p className="text-xl font-bold text-emerald-700">{leadershipTotal}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-gray-500">Senior</p>
              <p className="text-xl font-bold text-amber-700">{selected.seniorTrainers}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-4">
              <p className="text-gray-500">Master</p>
              <p className="text-xl font-bold text-rose-700">{selected.masterTrainers}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function PublicDashboard() {
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState('');
  const [hoveredState, setHoveredState] = useState('');
  const [hoveredGender, setHoveredGender] = useState<GenderDistributionItem | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'stats', 'global'), (doc) => {
      if (doc.exists()) {
        setStats(doc.data() as TrainingStats);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (stats?.teachersByState?.length) {
      setSelectedState((current) => current || stats.teachersByState[0].state);
    }
  }, [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dltt-green"></div>
      </div>
    );
  }

  const maleCount = stats?.genderDistribution?.find((item) => item.label === 'Male')?.count || 0;
  const femaleCount = stats?.genderDistribution?.find((item) => item.label === 'Female')?.count || 0;
  const genderTotal = stats?.genderDistribution?.reduce((sum, item) => sum + item.count, 0) || 0;
  const maxStateCount = Math.max(1, ...(stats?.teachersByState?.map((item) => item.count) || [1]));
  const growthByState: StateGrowthStats[] =
    stats?.growthByState?.length
      ? stats.growthByState
      : (stats?.teachersByState || []).map((item) => ({
          state: item.state,
          teachers: item.count,
          trainers: 0,
          seniorTrainers: 0,
          masterTrainers: 0,
          total: item.count,
        }));

  const cards = [
    { title: 'Total Teachers', value: stats?.enrollment || 0, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { title: 'Active Teachers', value: stats?.activeTeachers || 0, icon: Trophy, color: 'bg-yellow-50 text-yellow-600' },
    { title: 'States Covered', value: stats?.teachersByState?.length || 0, icon: Map, color: 'bg-purple-50 text-purple-600' },
    { title: 'Completion Rate', value: `${stats?.completionRate || 0}%`, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
    { title: 'Trainers', value: stats?.trainerCount || 0, icon: UserCheck, color: 'bg-emerald-50 text-emerald-600' },
    { title: 'Senior Trainers', value: stats?.seniorTrainerCount || 0, icon: Medal, color: 'bg-amber-50 text-amber-600' },
    { title: 'Master Trainers', value: stats?.masterTrainerCount || 0, icon: Sparkles, color: 'bg-rose-50 text-rose-600' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Training Impact Dashboard</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Real-time statistics from the Digital Literacy Training for Teachers (DLTT) initiative.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
          >
            <div className={`w-12 h-12 ${card.color} rounded-xl flex items-center justify-center mb-4`}>
              <card.icon size={24} />
            </div>
            <p className="text-sm font-medium text-gray-500">{card.title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="mb-8">
        <SouthwestGrowthMap
          data={growthByState}
          selectedState={selectedState}
          onSelectState={setSelectedState}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Teacher Distribution by State</h2>
              <p className="text-sm text-gray-500">Compare state-level teacher coverage and activity.</p>
            </div>
            <Map className="text-dltt-green" />
          </div>
          <div className="space-y-4">
            {stats?.teachersByState?.map((state) => (
              <button
                key={state.state}
                type="button"
                onClick={() => setSelectedState(state.state)}
                onMouseEnter={() => setHoveredState(state.state)}
                onMouseLeave={() => setHoveredState('')}
                className={`relative w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                  selectedState === state.state ? 'border-dltt-green bg-green-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                {hoveredState === state.state && (
                  <div className="absolute left-4 right-4 -top-24 z-20 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl text-sm text-gray-700">
                    <div className="font-semibold text-gray-900 mb-2">{state.state} details</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Active</p>
                        <p className="font-semibold text-gray-900">{state.activeCount}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Completion</p>
                        <p className="font-semibold text-gray-900">{state.completionRate}%</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Avg Score</p>
                        <p className="font-semibold text-gray-900">{state.avgScore}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 text-sm font-semibold text-gray-900">
                  <span>{state.state}</span>
                  <span>{state.count} teachers</span>
                </div>
                <div className="mt-3 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-dltt-green via-lime-400 to-yellow-400 transition-all duration-500"
                    style={{ width: `${Math.max(10, (state.count / maxStateCount) * 100)}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Teacher Gender Share</h2>
              <p className="text-sm text-gray-500">Live teacher distribution by gender.</p>
            </div>
            <Trophy className="text-dltt-green" />
          </div>
          <div className="flex flex-col items-center gap-6">
            <div className="relative w-full flex justify-center">
              <GenderPieChart
                data={stats?.genderDistribution || []}
                onSliceHover={(item) => setHoveredGender(item)}
                onSliceLeave={() => setHoveredGender(null)}
              />
              {hoveredGender && (
                <div className="absolute left-1/2 top-4 -translate-x-1/2 z-10 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-xl text-center text-sm text-gray-700">
                  <p className="font-semibold text-gray-900">{hoveredGender.label}</p>
                  <p className="mt-1">
                    {hoveredGender.count} teachers
                    {genderTotal > 0 ? ` · ${Math.round((hoveredGender.count / genderTotal) * 100)}%` : ''}
                  </p>
                </div>
              )}
            </div>
            <div className="w-full grid gap-3">
              {[
                { label: 'Male', value: maleCount, color: '#2e9107' },
                { label: 'Female', value: femaleCount, color: '#e9e51b' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-gray-50 p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{item.label}</p>
                    <p className="mt-1 text-xl font-bold text-gray-900">{item.value}</p>
                  </div>
                  <span className="h-3 w-16 rounded-full" style={{ backgroundColor: item.color }} />
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Teacher Leaderboard */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Top Performing Teachers</h2>
            <Trophy className="text-dltt-yellow" />
          </div>
          <div className="space-y-4">
            {stats?.teacherLeaderboard?.slice(0, 5).map((teacher, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center space-x-4">
                  <span className="text-lg font-bold text-gray-400 w-6">#{index + 1}</span>
                  <div>
                    <p className="font-bold text-gray-900">{teacher.name}</p>
                    <p className="text-xs text-gray-500">{teacher.state}</p>
                  </div>
                </div>
                <span className="font-bold text-dltt-green">{teacher.score} pts</span>
              </div>
            ))}
            {(!stats?.teacherLeaderboard || stats.teacherLeaderboard.length === 0) && (
              <p className="text-center text-gray-500 py-8">No data available yet.</p>
            )}
          </div>
        </motion.div>

        {/* State Leaderboard */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">State Performance</h2>
            <Map className="text-dltt-green" />
          </div>
          <div className="space-y-4">
            {stats?.stateLeaderboard?.map((state, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700">{state.state}</span>
                  <span className="font-bold text-gray-900">{state.score}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-dltt-green h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${state.score}%` }}
                  ></div>
                </div>
              </div>
            ))}
            {(!stats?.stateLeaderboard || stats.stateLeaderboard.length === 0) && (
              <p className="text-center text-gray-500 py-8">No data available yet.</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
