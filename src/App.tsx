/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Users, 
  BarChart3, 
  Plus, 
  Trash2, 
  BrainCircuit, 
  Trophy, 
  ChevronRight, 
  Info,
  UserPlus,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Candidate, Metric, MetricType, PromotionRecommendation, LayoffRecommendation } from './types';
import { analyzePromotion } from './services/gemini';
import { analyzeLayoffs } from './services/layoffService';
import ChatInterface from './components/ChatInterface';

const DEFAULT_METRICS: Metric[] = [
  { id: 'm1', name: 'Performance KPI', type: MetricType.NUMBER, weight: 0.3 },
  { id: 'm5', name: 'Years of Service', type: MetricType.NUMBER, weight: 0.2 },
  { id: 'm2', name: 'Leadership Potential', type: MetricType.RATING, weight: 0.2 },
  { id: 'm3', name: 'Technical Proficiency', type: MetricType.RATING, weight: 0.2 },
  { id: 'm4', name: 'Soft Skills', type: MetricType.RATING, weight: 0.1 },
];

const LAYOFF_METRICS: Metric[] = [
  { id: 'l1', name: 'Performance Rating', type: MetricType.NUMBER, weight: 0.4 },
  { id: 'l5', name: 'Years of Service', type: MetricType.NUMBER, weight: 0.3 },
  { id: 'l2', name: 'Skill Criticality', type: MetricType.RATING, weight: 0.2 },
  { id: 'l3', name: 'Attendance Record', type: MetricType.PERCENTAGE, weight: 0.05 },
  { id: 'l4', name: 'Disciplinary Record', type: MetricType.NUMBER, weight: 0.05 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'promotion' | 'layoff'>('promotion');
  const [promotionMetrics, setPromotionMetrics] = useState<Metric[]>(DEFAULT_METRICS);
  const [layoffMetrics, setLayoffMetrics] = useState<Metric[]>(LAYOFF_METRICS);
  
  const metrics = activeTab === 'promotion' ? promotionMetrics : layoffMetrics;
  const setMetrics = activeTab === 'promotion' ? setPromotionMetrics : setLayoffMetrics;

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState<PromotionRecommendation | null>(null);
  const [layoffRecommendation, setLayoffRecommendation] = useState<LayoffRecommendation | null>(null);
  const [layoffCount, setLayoffCount] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [isAddingMetric, setIsAddingMetric] = useState(false);
  const [newMetricName, setNewMetricName] = useState('');

  const [newCandidate, setNewCandidate] = useState<Partial<Candidate>>({
    name: '',
    role: '',
    department: '',
    tenure: '',
    metricValues: (activeTab === 'promotion' ? DEFAULT_METRICS : LAYOFF_METRICS).map(m => ({ metricId: m.id, value: 0 }))
  });

  const handleTabChange = (tab: 'promotion' | 'layoff') => {
    setActiveTab(tab);
    const targetMetrics = tab === 'promotion' ? promotionMetrics : layoffMetrics;
    setRecommendation(null);
    setLayoffRecommendation(null);
    setNewCandidate(prev => ({
      ...prev,
      metricValues: targetMetrics.map(m => ({ metricId: m.id, value: 0 }))
    }));
  };

  const generateSampleData = (count: number) => {
    const roles = ['Senior Developer', 'Project Manager', 'HR Specialist', 'Accountant', 'Sales Lead', 'Junior Analyst', 'Operations Manager'];
    const depts = ['Engineering', 'HR', 'Finance', 'Sales', 'Operations'];
    
    const samples: Candidate[] = Array.from({ length: count }).map((_, i) => {
      const id = Math.random().toString(36).substr(2, 9);
      const currentMetrics = activeTab === 'promotion' ? promotionMetrics : layoffMetrics;
      const years = Math.floor(Math.random() * 15) + 1;
      return {
        id,
        name: `Staff Member ${i + 1}`,
        role: roles[Math.floor(Math.random() * roles.length)],
        department: depts[Math.floor(Math.random() * depts.length)],
        tenure: `${years} years`,
        metricValues: currentMetrics.map(m => {
          let val = 0;
          if (m.id === 'l5' || m.id === 'm5') val = years; // Sync Years of Service metric for both modes
          else if (m.type === MetricType.RATING) val = Math.floor(Math.random() * 11);
          else val = Math.floor(Math.random() * 101);
          return { metricId: m.id, value: val };
        })
      };
    });
    setCandidates([...candidates, ...samples]);
  };

  const handleAddCandidate = () => {
    if (!newCandidate.name || !newCandidate.role) return;
    
    // Try to find Years of Service metric value to sync with tenure string
    const yearsMetric = newCandidate.metricValues?.find(mv => mv.metricId === 'l5' || mv.metricId === 'm5');
    const tenureStr = yearsMetric ? `${yearsMetric.value} years` : (newCandidate.tenure || '1 year');

    const candidate: Candidate = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCandidate.name!,
      role: newCandidate.role!,
      department: newCandidate.department || 'General',
      tenure: tenureStr,
      metricValues: newCandidate.metricValues || [],
      notes: newCandidate.notes
    };

    setCandidates([...candidates, candidate]);
    setNewCandidate({
      name: '',
      role: '',
      department: '',
      tenure: '',
      metricValues: metrics.map(m => ({ metricId: m.id, value: 0 }))
    });
  };

  const removeCandidate = (id: string) => {
    setCandidates(candidates.filter(c => c.id !== id));
    if (recommendation?.winnerId === id) setRecommendation(null);
  };

  const handleAddMetric = () => {
    if (!newMetricName.trim()) {
      setIsAddingMetric(false);
      return;
    }
    
    const newMetric: Metric = {
      id: `m${Date.now()}`,
      name: newMetricName.trim(),
      type: MetricType.NUMBER,
      weight: 0
    };

    // Update metrics
    setMetrics(prev => [...prev, newMetric]);

    // Update new candidate form
    setNewCandidate(prev => ({
      ...prev,
      metricValues: [...(prev.metricValues || []), { metricId: newMetric.id, value: 0 }]
    }));

    // Update existing candidates in pool to have this metric
    setCandidates(prev => prev.map(c => ({
      ...c,
      metricValues: [...c.metricValues, { metricId: newMetric.id, value: 0 }]
    })));

    setNewMetricName('');
    setIsAddingMetric(false);
  };

  const removeMetric = (id: string) => {
    if (metrics.length <= 1) {
      alert("At least one metric is required.");
      return;
    }
    setMetrics(prev => prev.filter(m => m.id !== id));
    setCandidates(prev => prev.map(c => ({
      ...c,
      metricValues: c.metricValues.filter(mv => mv.metricId !== id)
    })));
    setNewCandidate(prev => ({
      ...prev,
      metricValues: prev.metricValues?.filter(mv => mv.metricId !== id)
    }));
  };

  const clearPool = () => {
    if (confirm("Clear all candidates?")) {
      setCandidates([]);
      setRecommendation(null);
    }
  };

  const handleAnalyze = async () => {
    if (candidates.length < 2) {
      setError("Please add at least 2 candidates for comparison.");
      return;
    }
    setError(null);
    setIsAnalyzing(true);
    try {
      if (activeTab === 'promotion') {
        const result = await analyzePromotion(candidates, metrics);
        setRecommendation(result);
      } else {
        const result = await analyzeLayoffs(candidates, metrics, layoffCount);
        setLayoffRecommendation(result);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to analyze candidates. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const winner = useMemo(() => {
    return candidates.find(c => c.id === recommendation?.winnerId);
  }, [candidates, recommendation]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 lg:h-16 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shrink-0">
              <Users className="text-white w-5 h-5 lg:w-6 lg:h-6" />
            </div>
            <div>
              <h1 className="text-lg lg:text-xl font-bold tracking-tight leading-tight">Lubell HR Auditor</h1>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Mecer Consulting Audit Tool</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:gap-4">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => handleTabChange('promotion')}
                className={`flex-1 px-3 py-1.5 text-[10px] lg:text-xs font-bold rounded-md transition-all ${activeTab === 'promotion' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Promotion
              </button>
              <button 
                onClick={() => handleTabChange('layoff')}
                className={`flex-1 px-3 py-1.5 text-[10px] lg:text-xs font-bold rounded-md transition-all ${activeTab === 'layoff' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Layoff
              </button>
            </div>
            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing || candidates.length < 2}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-xs lg:text-sm transition-all shadow-sm text-white ${activeTab === 'promotion' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-red-600 hover:bg-red-700'} disabled:bg-slate-300`}
            >
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
              {isAnalyzing ? 'Analyzing...' : `Run ${activeTab === 'promotion' ? 'Promotion' : 'Layoff'} Audit`}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Configuration & Candidates */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* Metrics Configuration */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-indigo-600" />
                  <h2 className="font-semibold text-slate-800">Evaluation Metrics</h2>
                </div>
                <button 
                  onClick={() => setIsAddingMetric(true)}
                  className="min-h-[44px] px-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Metric
                </button>
              </div>
              <div className="p-4 lg:p-6 space-y-4">
                <AnimatePresence>
                  {isAddingMetric && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 overflow-hidden"
                    >
                      <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center gap-2">
                        <input 
                          autoFocus
                          type="text"
                          placeholder="Metric name..."
                          value={newMetricName}
                          onChange={e => setNewMetricName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddMetric()}
                          className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button 
                          onClick={handleAddMetric}
                          className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setIsAddingMetric(false);
                            setNewMetricName('');
                          }}
                          className="text-slate-400 hover:text-slate-600 p-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {activeTab === 'layoff' && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl">
                    <label className="text-xs font-bold text-red-800 uppercase block mb-2">Target Reduction Count</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        value={layoffCount}
                        onChange={e => setLayoffCount(parseInt(e.target.value) || 0)}
                        className="w-20 bg-white border border-red-200 rounded-md px-2 py-1 text-sm font-mono text-center"
                      />
                      <span className="text-xs text-red-600">staff members to be identified</span>
                    </div>
                  </div>
                )}
                {metrics.map((metric) => (
                  <div key={metric.id} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100 group">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-700">{metric.name}</p>
                        <button 
                          onClick={() => removeMetric(metric.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-400">{metric.type}</p>
                    </div>
                    <div className="w-24">
                      <div className="relative">
                        <input 
                          type="number" 
                          value={metric.weight} 
                          step="0.1"
                          min="0"
                          max="1"
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setMetrics(metrics.map(m => m.id === metric.id ? { ...m, weight: val } : m));
                          }}
                          className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-sm font-mono text-right"
                        />
                        <span className="absolute -top-4 right-0 text-[10px] text-slate-400">Weight</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Add Candidate Form */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  <h2 className="font-semibold text-slate-800">Add Candidate</h2>
                </div>
                <button 
                  onClick={() => generateSampleData(50)}
                  className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-wider"
                >
                  Generate 50 Samples
                </button>
              </div>
              <div className="p-4 lg:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. John Doe"
                      value={newCandidate.name}
                      onChange={e => setNewCandidate({...newCandidate, name: e.target.value})}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Current Role</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Senior Engineer"
                      value={newCandidate.role}
                      onChange={e => setNewCandidate({...newCandidate, role: e.target.value})}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
                
                <div className="space-y-3 pt-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metric Scores</p>
                  {metrics.map((m, idx) => (
                    <div key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                      <label className="text-[10px] font-bold text-slate-600 sm:w-32 truncate uppercase">{m.name}</label>
                      <div className="flex items-center gap-3 flex-1">
                        <input 
                          type="range" 
                          min="0" 
                          max={m.type === MetricType.RATING ? 10 : 100}
                          value={newCandidate.metricValues?.[idx]?.value || 0}
                          onChange={e => {
                            const newValues = [...(newCandidate.metricValues || [])];
                            newValues[idx] = { metricId: m.id, value: parseInt(e.target.value) || 0 };
                            setNewCandidate({...newCandidate, metricValues: newValues});
                          }}
                          className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <input 
                          type="number"
                          min="0"
                          max={m.type === MetricType.RATING ? 10 : 100}
                          value={newCandidate.metricValues?.[idx]?.value || 0}
                          onChange={e => {
                            const val = Math.min(m.type === MetricType.RATING ? 10 : 100, Math.max(0, parseInt(e.target.value) || 0));
                            const newValues = [...(newCandidate.metricValues || [])];
                            newValues[idx] = { metricId: m.id, value: val };
                            setNewCandidate({...newCandidate, metricValues: newValues});
                          }}
                          className="w-12 bg-white border border-slate-200 rounded px-1 py-0.5 text-[10px] font-mono font-bold text-center text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={handleAddCandidate}
                  className="w-full mt-4 bg-slate-900 hover:bg-black text-white py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add to Audit Pool
                </button>
              </div>
            </section>
          </div>

          {/* Right Column: Pool & Results */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Candidate Pool */}
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <h2 className="font-semibold text-slate-800">Candidate Pool ({candidates.length})</h2>
                </div>
                {candidates.length > 0 && (
                  <button 
                    onClick={clearPool}
                    className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-wider flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Clear Pool
                  </button>
                )}
              </div>
              <div className="p-6">
                {candidates.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
                    <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No candidates added yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence>
                      {candidates.map((c) => (
                        <motion.div 
                          key={c.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={`p-4 rounded-xl border transition-all ${recommendation?.winnerId === c.id ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 bg-white hover:border-slate-300'}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-bold text-slate-800">{c.name}</h3>
                              <p className="text-xs text-slate-500">{c.role}</p>
                            </div>
                            <button 
                              onClick={() => removeCandidate(c.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-1 mt-3">
                            {c.metricValues.map(mv => {
                              const m = metrics.find(met => met.id === mv.metricId);
                              return (
                                <div key={mv.metricId} className="flex justify-between text-[10px] uppercase tracking-tighter font-bold text-slate-400">
                                  <span>{m?.name}</span>
                                  <span className="text-slate-600">{mv.value}{m?.type === MetricType.PERCENTAGE ? '%' : ''}</span>
                                </div>
                              );
                            })}
                          </div>
                          {recommendation?.winnerId === c.id && (
                            <div className="mt-3 flex items-center gap-1 text-emerald-600 text-[10px] font-bold uppercase">
                              <Trophy className="w-3 h-3" /> Recommended for Promotion
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </section>

            {/* Analysis Results */}
            <AnimatePresence>
              {(recommendation || layoffRecommendation || isAnalyzing || error) && (
                <motion.section 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  {isAnalyzing && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
                      <div className="relative w-16 h-16 mx-auto">
                        <Loader2 className={`w-16 h-16 ${activeTab === 'promotion' ? 'text-indigo-600' : 'text-red-600'} animate-spin`} />
                        <BrainCircuit className="w-8 h-8 text-slate-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">Gemini is auditing candidates...</h3>
                        <p className="text-sm text-slate-500">Evaluating metrics, weights, and organizational risk.</p>
                      </div>
                    </div>
                  )}

                  {recommendation && activeTab === 'promotion' && !isAnalyzing && (
                    <div className="space-y-6">
                      {/* Winner Card */}
                      <div className="bg-slate-900 rounded-2xl p-6 lg:p-8 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 lg:p-8 opacity-10">
                          <Trophy className="w-24 h-24 lg:w-32 lg:h-32" />
                        </div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-bold uppercase tracking-widest mb-4">
                            <CheckCircle2 className="w-4 h-4" /> Audit Recommendation
                          </div>
                          <h2 className="text-2xl lg:text-3xl font-bold mb-1">{winner?.name}</h2>
                          <p className="text-sm text-slate-400 mb-6">{winner?.role} • {winner?.department}</p>
                          
                          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 lg:p-6 border border-white/10">
                            <h4 className="text-[10px] font-bold uppercase text-indigo-300 mb-2">Reasoning</h4>
                            <p className="text-xs lg:text-sm leading-relaxed text-slate-200 italic">
                              "{recommendation.reasoning}"
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Detailed Comparison */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                          <h3 className="font-semibold text-slate-800">Comparative Analysis</h3>
                        </div>
                        <div className="p-6 space-y-6">
                          <p className="text-sm text-slate-600 leading-relaxed">
                            {recommendation.comparisonSummary}
                          </p>
                          
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Candidate Rankings</h4>
                            {recommendation.rankings.map((rank, idx) => {
                              const cand = candidates.find(c => c.id === rank.candidateId);
                              return (
                                <div key={rank.candidateId} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-bold text-slate-800">{cand?.name}</span>
                                      <span className="text-xs font-mono font-bold text-indigo-600">{rank.score}/100</span>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">{rank.justification}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {layoffRecommendation && activeTab === 'layoff' && !isAnalyzing && (
                    <div className="space-y-6">
                      {/* Layoff Summary Card */}
                      <div className="bg-red-950 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                          <AlertCircle className="w-32 h-32" />
                        </div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-2 text-red-400 text-xs font-bold uppercase tracking-widest mb-4">
                            <AlertCircle className="w-4 h-4" /> Workforce Reduction Strategy
                          </div>
                          <h2 className="text-3xl font-bold mb-1">{layoffRecommendation.suggestedLayoffIds.length} Staff Suggested for Layoff</h2>
                          <p className="text-red-200/60 mb-6">Based on performance, tenure, and organizational criticality.</p>
                          
                          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                            <h4 className="text-sm font-bold uppercase text-red-300 mb-2">Strategic Reasoning</h4>
                            <p className="text-sm leading-relaxed text-slate-200 italic">
                              "{layoffRecommendation.reasoning}"
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Risk Assessment */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                          <h3 className="font-semibold text-slate-800">Organizational Risk Assessment</h3>
                        </div>
                        <div className="p-6 space-y-6">
                          <p className="text-sm text-slate-600 leading-relaxed">
                            {layoffRecommendation.riskAssessment}
                          </p>
                          
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Candidate Priority List</h4>
                            {layoffRecommendation.rankings.map((rank, idx) => {
                              const cand = candidates.find(c => c.id === rank.candidateId);
                              const isSuggested = layoffRecommendation.suggestedLayoffIds.includes(rank.candidateId);
                              return (
                                <div key={rank.candidateId} className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${isSuggested ? 'border-red-200 bg-red-50/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isSuggested ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {idx + 1}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className={`font-bold ${isSuggested ? 'text-red-900' : 'text-slate-800'}`}>{cand?.name}</span>
                                      <span className={`text-xs font-mono font-bold ${rank.riskScore > 70 ? 'text-red-600' : 'text-slate-500'}`}>Risk: {rank.riskScore}/100</span>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">{rank.justification}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-slate-400">
            <Info className="w-4 h-4" />
            <p className="text-xs">This tool is for advisory purposes as part of the Mecer Consulting HR Audit for Lubell Nigeria Ltd.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-px w-12 bg-slate-200" />
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Powered by Gemini AI</span>
            <div className="h-px w-12 bg-slate-200" />
          </div>
        </div>
      </footer>
      <ChatInterface />
    </div>
  );
}
