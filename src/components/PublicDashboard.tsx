import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TrainingStats } from '../types';
import { Users, GraduationCap, Map, Trophy } from 'lucide-react';
import { motion } from 'motion/react';

export default function PublicDashboard() {
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'stats', 'global'), (doc) => {
      if (doc.exists()) {
        setStats(doc.data() as TrainingStats);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dltt-green"></div>
      </div>
    );
  }

  const cards = [
    { title: 'Total Enrollment', value: stats?.enrollment || 0, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { title: 'Completion Rate', value: `${stats?.completionRate || 0}%`, icon: GraduationCap, color: 'bg-green-50 text-green-600' },
    { title: 'States Covered', value: '6', icon: Map, color: 'bg-purple-50 text-purple-600' },
    { title: 'Active Teachers', value: stats?.teacherLeaderboard?.length || 0, icon: Trophy, color: 'bg-yellow-50 text-yellow-600' },
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
