import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, BarChart3, BookOpen, GraduationCap, MapPinned, Users } from 'lucide-react';
import { STATES } from '../constants';
import foundationLogo from '../assets/foundation-logo.png';
import teachersLearningArtwork from '../assets/teachers-learning.png';

const highlights = [
  {
    title: '3,000 Teachers',
    description: 'A regional capacity-building effort designed to reach teachers across the Southwest.',
    icon: Users,
    accent: 'bg-amber-100 text-amber-700',
  },
  {
    title: '72 Master Trainers',
    description: 'Twelve carefully selected ICT teachers from each state form the first cohort of lead trainers.',
    icon: GraduationCap,
    accent: 'bg-emerald-100 text-emerald-700',
  },
  {
    title: 'Train-the-Trainer Model',
    description: 'Master Trainers cascade the programme in their localities with support from the Foundation.',
    icon: BookOpen,
    accent: 'bg-sky-100 text-sky-700',
  },
  {
    title: 'Live Programme Metrics',
    description: 'A transparent view into enrollment, activity, and statewide training performance.',
    icon: BarChart3,
    accent: 'bg-rose-100 text-rose-700',
  },
];

export default function LandingPage() {
  return (
    <div className="overflow-hidden">
      <section className="relative bg-[radial-gradient(circle_at_top_left,_rgba(248,236,60,0.28),_transparent_32%),linear-gradient(135deg,_#f8f6ef_0%,_#ffffff_45%,_#edf8f1_100%)]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-14 left-[8%] h-32 w-32 rounded-full bg-dltt-yellow/20 blur-3xl" />
          <div className="absolute bottom-10 right-[10%] h-40 w-40 rounded-full bg-dltt-green/12 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
                className="inline-flex items-center gap-2 rounded-full border border-dltt-green/15 bg-white/80 px-4 py-2 text-sm font-semibold text-dltt-green shadow-sm backdrop-blur"
              >
                <MapPinned size={16} />
                Digital Education For Innovation and Economic Development
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
                className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-950 leading-tight"
              >
                Building a stronger digital teaching workforce across the Southwest.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="mt-6 max-w-3xl text-lg sm:text-xl text-slate-600 leading-8"
              >
                The Odu&apos;a Investment Foundation&apos;s <span className="font-semibold text-slate-900">DEFINED Project</span>,
                in collaboration with the State Ministries of Education, is training teachers to lead digital-learning
                transformation in their schools and local communities.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="mt-8 flex flex-col sm:flex-row gap-4"
              >
                <Link to="/dashboard" className="btn-primary">
                  <span>Go to Dashboard</span>
                  <ArrowRight size={18} />
                </Link>
                <Link
                  to="/stats"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                >
                  <span>View Public Stats</span>
                  <BarChart3 size={18} />
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4"
              >
                <div className="rounded-2xl bg-white/85 border border-white shadow-sm px-5 py-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400 font-bold">Coverage</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">6 States</p>
                  <p className="mt-2 text-sm text-slate-600">Ekiti, Oyo, Ogun, Osun, Lagos, and Ondo.</p>
                </div>
                <div className="rounded-2xl bg-white/85 border border-white shadow-sm px-5 py-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400 font-bold">Training Model</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">Cascade</p>
                  <p className="mt-2 text-sm text-slate-600">Master Trainers scale support into local teaching clusters.</p>
                </div>
                <div className="rounded-2xl bg-white/85 border border-white shadow-sm px-5 py-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400 font-bold">Implementation</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">Supported</p>
                  <p className="mt-2 text-sm text-slate-600">The Foundation backs local delivery with coordinated support.</p>
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.12 }}
              className="relative"
            >
              <div className="rounded-[2rem] border border-emerald-100 bg-white/95 shadow-[0_25px_80px_-30px_rgba(20,107,53,0.42)] overflow-hidden">
                <div className="relative p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Programme in Action</p>
                      <h2 className="mt-2 text-2xl font-black text-slate-950">Teachers learning, leading, and cascading impact.</h2>
                    </div>
                    <div className="rounded-2xl bg-[#f6f9f0] border border-emerald-100 p-3 shadow-sm">
                      <img src={foundationLogo} alt="Foundation logo placeholder" className="h-12 w-12" />
                    </div>
                  </div>

                  <div className="mt-6 rounded-[1.6rem] overflow-hidden border border-slate-100 bg-slate-50">
                    <img
                      src={teachersLearningArtwork}
                      alt="Illustrated placeholder of teachers learning together in a training session"
                      className="w-full h-auto block"
                    />
                  </div>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
                      <p className="text-sm font-bold text-slate-950">Phase 1</p>
                      <p className="mt-1 text-slate-600">Train 72 Master Trainers, with 12 ICT teachers selected from each of the six states.</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
                      <p className="text-sm font-bold text-slate-950">Phase 2</p>
                      <p className="mt-1 text-slate-600">Each Master Trainer cascades the training to 20 to 30 teachers in their localities.</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
                      <p className="text-sm font-bold text-slate-950">Phase 3</p>
                      <p className="mt-1 text-slate-600">Coordinators monitor activity, score assignments, and track progress statewide.</p>
                    </div>
                  </div>

                  <div className="mt-8 rounded-3xl bg-[linear-gradient(135deg,_#146b35_0%,_#1b8e46_55%,_#6eb889_100%)] text-white p-6">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/70 font-bold">Target Outcome</p>
                    <p className="mt-3 text-3xl font-black">3,000 teachers equipped to lead digital learning.</p>
                    <p className="mt-3 text-sm text-white/80">
                      A focused intervention designed to create practical classroom impact through structured regional collaboration.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-dltt-green">Why this matters</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-black text-slate-950">
            A practical, scalable response to digital teaching readiness.
          </h2>
          <p className="mt-5 text-lg text-slate-600 leading-8">
            DEFINED brings together Foundation support, state education structures, and teacher-led cascade delivery to
            create a model that is both ambitious and grounded in local realities.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {highlights.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-lg transition-shadow"
            >
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${item.accent}`}>
                <item.icon size={24} />
              </div>
              <h3 className="mt-5 text-xl font-black text-slate-950">{item.title}</h3>
              <p className="mt-3 text-slate-600 leading-7">{item.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 items-start">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-dltt-yellow">Regional Reach</p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-black">Working across every Southwest state with shared purpose.</h2>
              <p className="mt-5 text-white/75 leading-8">
                The programme aligns with State Ministries of Education while keeping delivery close to the teachers who
                will carry the training forward in their own communities.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {STATES.map((state, index) => (
                <motion.div
                  key={state}
                  initial={{ opacity: 0, scale: 0.96 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-4 py-5"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45 font-bold">State</p>
                  <p className="mt-3 text-lg font-bold text-white">{state.replace(' State', '')}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.45 }}
          className="rounded-[2rem] border border-dltt-green/10 bg-[linear-gradient(135deg,_#1b8e46_0%,_#146b35_100%)] p-8 sm:p-10 text-white shadow-[0_25px_80px_-30px_rgba(20,107,53,0.55)]"
        >
          <p className="text-sm uppercase tracking-[0.24em] text-white/60 font-bold">Take the next step</p>
          <h2 className="mt-4 text-3xl sm:text-4xl font-black max-w-2xl">
            Explore programme performance or head straight into the training portal.
          </h2>
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Link
              to="/stats"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-bold text-dltt-green hover:bg-slate-100 transition-colors"
            >
              <span>Open Public Dashboard</span>
              <BarChart3 size={18} />
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/15 transition-colors"
            >
              <span>Go to Portal Dashboard</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
