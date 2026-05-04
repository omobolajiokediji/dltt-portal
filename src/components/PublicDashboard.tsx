import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GenderDistributionItem, TrainingStats } from '../types';
import { Users, GraduationCap, Map, Trophy } from 'lucide-react';
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
  const maxStateCount = Math.max(1, ...(stats?.teachersByState?.map((item) => item.count) || [1]));

  const cards = [
    { title: 'Total Teachers', value: stats?.enrollment || 0, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { title: 'Active Teachers', value: stats?.activeTeachers || 0, icon: Trophy, color: 'bg-yellow-50 text-yellow-600' },
    { title: 'States Covered', value: stats?.teachersByState?.length || 0, icon: Map, color: 'bg-purple-50 text-purple-600' },
    { title: 'Completion Rate', value: `${stats?.completionRate || 0}%`, icon: GraduationCap, color: 'bg-green-50 text-green-600' },
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
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
                  <p className="mt-1">{hoveredGender.count} teachers</p>
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
