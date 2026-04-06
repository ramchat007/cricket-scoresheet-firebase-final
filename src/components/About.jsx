import React from "react";
import { useTheme } from "../context/ThemeContext";
import {
  Activity,
  Gavel,
  Youtube,
  GitMerge,
  Users,
  Trophy,
  Globe,
  Share2,
} from "lucide-react";
import { Helmet } from "react-helmet-async";

export default function AboutPage() {
  const { theme, lightMode } = useTheme();

  // 🟢 Updated Services Data with Global Stats & Public Profiles
  const features = [
    {
      icon: Users,
      title: "Comprehensive Organization",
      desc: "Organise Tournaments seamlessly with Umpires management, Offline scorers, Online scorers, and on-demand Commentators.",
    },
    {
      icon: Activity,
      title: "Real-Time Scoring",
      desc: "Lightning-fast, ball-by-ball digital scoresheets synced instantly across all devices.",
    },
    {
      icon: Gavel,
      title: "Live Player Auctions",
      desc: "Manage virtual wallets, team owners, and live bidding effortlessly in real-time.",
    },
    {
      icon: Youtube,
      title: "Live Broadcasting",
      desc: "Seamless Live YouTube streaming integration featuring professional, Broadcast-ready overlays.",
    },
    {
      icon: GitMerge,
      title: "Automated Brackets",
      desc: "Smart tournament trees that auto-advance winners and instantly update table standings.",
    },
    {
      icon: Globe,
      title: "Global Player Stats",
      desc: "Track career milestones! Every run and wicket is automatically tallied across all tournaments.",
    },
  ];

  return (
    <>
      <Helmet>
        <title>About Us | Live Scoring & Auction</title>
        <meta
          name="description"
          content="Learn more about CricSync and our mission to revolutionize local cricket tournaments."
        />
        <meta property="og:title" content="About Us | Live Scoring & Auction" />
        <meta
          property="og:description"
          content="Learn more about CricSync and our mission to revolutionize local cricket tournaments."
        />
      </Helmet>

      <div
        className={`max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in ${theme.text}`}
      >
        {/* Header Section */}
        <div className="text-center mb-16 mt-8">
          <div className="flex justify-center mb-6">
            <div
              className={`p-4 rounded-full ${lightMode ? "bg-teal-50" : "bg-teal-500/10"}`}
            >
              <Trophy size={48} className="text-teal-500" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter mb-4 text-teal-500">
            Elevating Local Cricket
          </h1>
          <p
            className={`text-lg max-w-2xl mx-auto font-medium ${lightMode ? "text-gray-600" : "text-slate-400"}`}
          >
            CricSync is a premium tournament management platform designed to
            bring professional-grade tools to local and corporate cricket
            leagues.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {features.map((f, i) => (
            <div
              key={i}
              className={`p-6 md:p-8 rounded-3xl border transition-all duration-300 hover:-translate-y-1 ${
                lightMode
                  ? "bg-white border-gray-200 shadow-xl hover:border-teal-300 hover:shadow-teal-500/10"
                  : "bg-[#1C2128] border-white/5 hover:border-teal-500/30 shadow-lg"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${lightMode ? "bg-teal-50 text-teal-600" : "bg-teal-500/10 text-teal-400"}`}
              >
                <f.icon size={24} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-widest mb-3 leading-tight">
                {f.title}
              </h3>
              <p
                className={`text-sm leading-relaxed font-medium ${lightMode ? "text-gray-500" : "text-slate-400"}`}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* --- 🚀 REDESIGNED TEAM & MISSION SECTION --- */}
        <div className="mt-20 mb-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-500 mb-4">
              Behind CricSync
            </h2>
            <p
              className={`max-w-2xl mx-auto font-bold uppercase tracking-widest text-xs md:text-sm ${theme.sub}`}
            >
              Expertise • Discipline • Industry Standards
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Block: The Team & Ethos (Spans 5 cols) */}
            <div
              className={`lg:col-span-5 p-8 md:p-10 rounded-[2.5rem] border relative overflow-hidden flex flex-col justify-center ${lightMode ? "bg-gradient-to-br from-teal-50 to-white border-teal-100 shadow-xl" : "bg-gradient-to-br from-teal-900/20 to-[#161920] border-white/10 shadow-2xl"}`}
            >
              {/* Background Graphic */}
              <div className="absolute -top-20 -left-20 w-64 h-64 bg-teal-500/20 blur-[100px] rounded-full pointer-events-none"></div>

              <div className="relative z-10">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${lightMode ? "bg-white text-teal-600" : "bg-teal-500/20 text-teal-400"}`}
                >
                  <Users size={28} />
                </div>
                <h3
                  className={`text-2xl font-black uppercase mb-4 leading-tight ${theme.text}`}
                >
                  The Experts on the Ground
                </h3>
                <p
                  className={`text-sm leading-relaxed font-medium mb-8 ${lightMode ? "text-gray-600" : "text-slate-400"}`}
                >
                  We are a passionate team of developers and hardcore cricket
                  enthusiasts. But more importantly, we are experienced
                  tournament managers. We know what it takes to run an event
                  with absolute discipline, proper etiquette, and deep
                  cricketing knowledge.
                </p>

                {/* Ethos Badges */}
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border ${lightMode ? "bg-white border-gray-200 text-gray-700" : "bg-black/30 border-white/10 text-slate-300"}`}
                  >
                    Professional Management
                  </span>
                  <span
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border ${lightMode ? "bg-white border-gray-200 text-gray-700" : "bg-black/30 border-white/10 text-slate-300"}`}
                  >
                    Disciplined Execution
                  </span>
                </div>
              </div>
            </div>

            {/* Right Block: Mission & Target Strategy (Spans 7 cols) */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Mission Card */}
              <div
                className={`sm:col-span-2 p-8 md:p-10 rounded-[2.5rem] border relative overflow-hidden ${lightMode ? "bg-white border-gray-200 shadow-xl" : "bg-[#1C2128] border-white/5 shadow-2xl"}`}
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none"></div>
                <div className="relative z-10">
                  <h3
                    className={`text-sm font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${lightMode ? "text-indigo-600" : "text-indigo-400"}`}
                  >
                    <Trophy size={16} /> Our Core Mission
                  </h3>
                  <p
                    className={`text-base md:text-lg font-medium leading-relaxed ${lightMode ? "text-gray-800" : "text-slate-200"}`}
                  >
                    Our mission is to provide an{" "}
                    <strong>industry-standard experience</strong> with
                    high-quality tools. We ensure your entire tournament is
                    managed effectively, maintaining the highest levels of
                    discipline and cricketing knowledge from the first ball to
                    the final presentation.
                  </p>
                </div>
              </div>

              {/* Strategy Card 1: Grassroots */}
              <div
                className={`p-6 md:p-8 rounded-[2rem] border flex flex-col justify-center transition-transform hover:-translate-y-1 ${lightMode ? "bg-gray-50 border-gray-200" : "bg-[#13161a] border-white/5"}`}
              >
                <Activity className="text-amber-500 mb-4" size={24} />
                <h4
                  className={`text-sm font-black uppercase tracking-widest mb-2 ${theme.text}`}
                >
                  Empowering the Grassroots
                </h4>
                <p
                  className={`text-xs font-medium leading-relaxed ${lightMode ? "text-gray-600" : "text-slate-400"}`}
                >
                  Many local tournaments compromise on quality due to limited
                  budgets or technical resources. We target these leagues first,
                  bringing them premium online services they never thought
                  possible.
                </p>
              </div>

              {/* Strategy Card 2: Big Leagues */}
              <div
                className={`p-6 md:p-8 rounded-[2rem] border flex flex-col justify-center transition-transform hover:-translate-y-1 ${lightMode ? "bg-indigo-50 border-indigo-100" : "bg-indigo-900/10 border-indigo-500/20"}`}
              >
                <GitMerge className="text-indigo-500 mb-4" size={24} />
                <h4
                  className={`text-sm font-black uppercase tracking-widest mb-2 ${theme.text}`}
                >
                  Scaling to the Big Leagues
                </h4>
                <p
                  className={`text-xs font-medium leading-relaxed ${lightMode ? "text-gray-600" : "text-slate-400"}`}
                >
                  Once the foundation is set, we scale our infrastructure to
                  support massive, high-stakes tournaments that require heavy
                  resources, flawless execution, and robust digital ecosystems.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
