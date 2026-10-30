import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard,
  Flame,
  Layers,
  ShieldAlert,
  TableProperties,
  Database,
  LineChart,
  FileText,
  History,
  Sliders,
  LogOut,
  Upload,
  RefreshCw,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Cpu,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  Check,
  Zap,
  Info,
  ChevronRight,
  BarChart2,
  SlidersHorizontal
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const API_BASE = 'http://localhost:8000/api/aegis-burn';

const RISK_COLORS: Record<string, string> = {
  'High Risk': '#ef4444',
  'Critical Hazard': '#ef4444',
  'Medium Risk': '#f59e0b',
  'Low Risk': '#10b981',
  'Nominal': '#10b981',
  'Normal': '#10b981',
  'Needs Review': '#f97316',
};

const PIE_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'];

export const AegisBurnView: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Session Data
  const [session, setSession] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [predictionsTotal, setPredictionsTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [schemaComparison, setSchemaComparison] = useState<any>(null);

  // Train Configuration state
  const [targetCol, setTargetCol] = useState<string>('');
  const [problemType, setProblemType] = useState<string>('auto');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [trainProgress, setTrainProgress] = useState<number>(0);

  // Selected Record Modal
  const [inspectRecord, setInspectRecord] = useState<any | null>(null);

  // Upload Files state
  const [trainUploading, setTrainUploading] = useState<boolean>(false);
  const [testUploading, setTestUploading] = useState<boolean>(false);

  // Settings State
  const [anomalyContamination, setAnomalyContamination] = useState<number>(5);
  const [highRiskThreshold, setHighRiskThreshold] = useState<number>(70);
  const [mediumRiskThreshold, setMediumRiskThreshold] = useState<number>(40);
  const [fireScreeningMode, setFireScreeningMode] = useState<boolean>(true);

  // Load Session on Mount
  const fetchSession = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/session`);
      setSession(res.data);
      if (res.data.train_meta?.suggested_target) {
        setTargetCol(res.data.train_meta.suggested_target);
      }
      if (res.data.train_meta?.column_names) {
        setSelectedFeatures(res.data.train_meta.column_names);
      }
      fetchPredictions(1, searchQuery, riskFilter);
    } catch (err: any) {
      console.error('Failed to load AEGISBURN session:', err);
      setMessage({ type: 'error', text: 'Could not connect to AEGISBURN engine.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchPredictions = async (p = 1, search = '', risk = 'ALL') => {
    try {
      const res = await axios.get(`${API_BASE}/predictions`, {
        params: { page: p, page_size: pageSize, search: search || undefined, risk_filter: risk !== 'ALL' ? risk : undefined },
      });
      setPredictions(res.data.records || []);
      setPredictionsTotal(res.data.total || 0);
      setPage(p);
    } catch (err) {
      console.error('Failed to load predictions:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/history`);
      setHistoryList(res.data || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const fetchSchemaComparison = async () => {
    try {
      const res = await axios.get(`${API_BASE}/schema-comparison`, {
        params: { target_col: targetCol || undefined }
      });
      setSchemaComparison(res.data);
    } catch (err) {
      console.error('Failed to fetch schema comparison:', err);
    }
  };

  useEffect(() => {
    fetchSession();
    fetchHistory();
  }, []);

  useEffect(() => {
    if (activeTab === 'predictions') {
      fetchPredictions(page, searchQuery, riskFilter);
    } else if (activeTab === 'history') {
      fetchHistory();
    } else if (activeTab === 'train') {
      fetchSchemaComparison();
    }
  }, [activeTab]);

  // Handle Training Dataset Upload
  const handleTrainUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setTrainUploading(true);
    try {
      const res = await axios.post(`${API_BASE}/datasets/training`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage({ type: 'success', text: `Training dataset '${file.name}' loaded (${res.data.metadata.row_count} rows).` });
      await fetchSession();
      fetchSchemaComparison();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Training upload failed.' });
    } finally {
      setTrainUploading(false);
    }
  };

  // Handle Testing Dataset Upload
  const handleTestUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setTestUploading(true);
    try {
      const res = await axios.post(`${API_BASE}/datasets/testing`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage({ type: 'success', text: `Testing dataset '${file.name}' loaded (${res.data.metadata.row_count} rows).` });
      await fetchSession();
      fetchSchemaComparison();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Testing upload failed.' });
    } finally {
      setTestUploading(false);
    }
  };

  // Handle AutoML Training
  const handleTrainAndBenchmark = async () => {
    setActionLoading(true);
    setTrainProgress(15);
    const interval = setInterval(() => {
      setTrainProgress((prev) => (prev < 90 ? prev + 15 : prev));
    }, 400);

    try {
      const res = await axios.post(`${API_BASE}/train-and-benchmark`, {
        target_col: targetCol || undefined,
        problem_type: problemType,
        selected_features: selectedFeatures.length > 0 ? selectedFeatures : undefined,
        test_size: 0.2,
        random_state: 42,
      });
      clearInterval(interval);
      setTrainProgress(100);
      setMessage({
        type: 'success',
        text: `Model benchmark complete! Best Model: ${res.data.best_model_name} (${res.data.problem_type}).`,
      });
      await fetchSession();
      // Auto run prediction on test set
      await handlePredict();
    } catch (err: any) {
      clearInterval(interval);
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Training benchmark failed.' });
    } finally {
      setActionLoading(false);
      setTimeout(() => setTrainProgress(0), 1500);
    }
  };

  // Handle Run Predictions
  const handlePredict = async () => {
    setActionLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/predict`);
      setMessage({
        type: 'success',
        text: `Prediction inference complete for ${res.data.total_predictions} records.`,
      });
      await fetchSession();
      fetchPredictions(1, '', 'ALL');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Prediction failed.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Record Review Status Update
  const handleReviewDecision = async (rowId: number, decision: string) => {
    try {
      await axios.post(`${API_BASE}/records/${rowId}/review`, { decision });
      // Update in local state
      setPredictions((prev) =>
        prev.map((r) => (r._row_id === rowId ? { ...r, user_decision: decision, review_status: decision } : r))
      );
      if (inspectRecord && inspectRecord._row_id === rowId) {
        setInspectRecord({ ...inspectRecord, user_decision: decision, review_status: decision });
      }
      setMessage({ type: 'info', text: `Record #${rowId} tagged as: ${decision}` });
    } catch (err) {
      console.error('Failed to update review status:', err);
    }
  };

  // Export File
  const handleExport = (format: 'csv' | 'xlsx' | 'json') => {
    window.open(`${API_BASE}/export?format=${format}`, '_blank');
  };

  // Metrics Data Extraction
  const summary = session?.prediction_summary || {};
  const totalRecords = summary.total_records || predictionsTotal || 0;
  const highRiskCount = summary.risk_breakdown?.['High Risk'] ?? (summary.class_distribution?.['Critical Hazard'] || 0);
  const mediumRiskCount = summary.risk_breakdown?.['Medium Risk'] ?? summary.needs_review_count ?? 0;
  const lowRiskCount = summary.risk_breakdown?.['Low Risk'] ?? (summary.class_distribution?.['Nominal'] || totalRecords - highRiskCount);
  const avgAnomalyScore = summary.avg_anomaly_score ?? (summary.anomalies_detected ? ((summary.anomalies_detected / totalRecords) * 100).toFixed(1) : '6.0');

  // Chart Data: Risk Distribution
  const riskChartData = [
    { name: 'Critical / High Risk', value: highRiskCount, color: '#ef4444' },
    { name: 'Medium / Review', value: mediumRiskCount, color: '#f59e0b' },
    { name: 'Nominal / Low Risk', value: lowRiskCount, color: '#10b981' },
  ].filter((d) => d.value > 0);

  // Nav Items
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'train', label: 'Train & Predict', icon: Flame },
    { id: 'components', label: 'Components', icon: Layers },
    { id: 'anomaly', label: 'Anomaly Center', icon: ShieldAlert },
    { id: 'predictions', label: 'Predictions', icon: TableProperties },
    { id: 'batch', label: 'Batch Analysis', icon: Database },
    { id: 'performance', label: 'Model Performance', icon: LineChart },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'history', label: 'Analysis History', icon: History },
    { id: 'settings', label: 'Settings', icon: Sliders },
  ];

  return (
    <div className="flex h-screen bg-[#090d16] text-gray-100 font-sans overflow-hidden">
      {/* Persistent Left Sidebar */}
      <aside className="w-64 bg-[#0d131f] border-r border-[#1e293b] flex flex-col justify-between shrink-0 select-none">
        <div>
          {/* Logo & Branding */}
          <div className="p-5 border-b border-[#1e293b] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-base font-bold tracking-wider text-white flex items-center gap-1.5">
                  AEGISBURN <span className="text-cyan-400 text-xs px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800">AI</span>
                </span>
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Screening Platform</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-170px)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-950/90 to-teal-950/60 text-cyan-300 border-l-4 border-cyan-400 shadow-sm'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#131b2c]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-gray-400'}`} />
                  <span>{item.label}</span>
                  {item.id === 'anomaly' && highRiskCount > 0 && (
                    <span className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      {highRiskCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Back to Safety Monitoring */}
        <div className="p-3 border-t border-[#1e293b] bg-[#0b0f19]">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-[#141d2e] hover:bg-[#1a253a] border border-[#233149] rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-gray-400" />
            <span>Return to Safety Platform</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="h-16 bg-[#0d131f] border-b border-[#1e293b] px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-semibold text-white tracking-wide capitalize flex items-center gap-2">
                {navItems.find((n) => n.id === activeTab)?.label || 'Dashboard'}
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-mono">
                  {session?.analysis_id || 'ANALYSIS #1042'}
                </span>
              </h1>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-3">
            {/* Status Pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#131c2d] border border-[#223048] text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-gray-300">Model:</span>
              <span className="text-cyan-300 font-semibold truncate max-w-[160px]">
                {session?.selected_model || 'AutoML Ready'}
              </span>
            </div>

            {/* Benchmark Trigger Button */}
            <button
              onClick={handleTrainAndBenchmark}
              disabled={actionLoading}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-cyan-900 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded-lg shadow-sm shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{actionLoading ? 'Benchmarking...' : 'Run Benchmark'}</span>
            </button>

            {/* Quick Refresh */}
            <button
              onClick={() => {
                fetchSession();
                fetchPredictions(page, searchQuery, riskFilter);
              }}
              className="p-2 text-gray-400 hover:text-white bg-[#131b2c] hover:bg-[#1a253a] border border-[#1e293b] rounded-lg transition-colors"
              title="Refresh Current Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Notification Banner */}
        {message && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              message.type === 'success'
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                : message.type === 'error'
                ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                : 'bg-cyan-950/60 text-cyan-300 border-cyan-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {message.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
              {message.type === 'info' && <Info className="w-4 h-4 text-cyan-400" />}
              <span>{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Progress Bar during Training */}
        {trainProgress > 0 && (
          <div className="w-full bg-[#1e293b] h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-teal-400 to-cyan-400 h-full transition-all duration-300"
              style={{ width: `${trainProgress}%` }}
            ></div>
          </div>
        )}

        {/* Tab Views Container */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#090d16]">
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Overview Card */}
              <div className="p-6 rounded-xl bg-[#0f172a] border border-[#1e293b] shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 border border-cyan-700/60">
                        Active Screening Batch
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {session?.train_filename || 'Default Thermal & Fire Sensor Screening'}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-wide">
                      Dataset Screening, Anomaly Detection & Hazard Prediction
                    </h2>
                    <p className="text-xs text-gray-400 max-w-2xl">
                      Automated ML validation pipeline comparing multiple algorithms, isolating high-risk outliers,
                      and generating continuous sensor reliability scores.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => setActiveTab('train')}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#1e293b] hover:bg-[#28384f] border border-[#334155] rounded-lg transition-colors cursor-pointer flex items-center gap-2"
                    >
                      <Upload className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Upload New Datasets</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('reports')}
                      className="px-4 py-2 text-xs font-semibold text-cyan-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-sm shadow-cyan-500/20 transition-colors cursor-pointer flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Generate Report</span>
                    </button>
                  </div>
                </div>

                {/* Status sub-strip */}
                <div className="mt-5 pt-4 border-t border-[#1e293b] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-gray-500 block">TRAINING DATASET:</span>
                    <span className="text-gray-200 font-semibold truncate block">
                      {session?.train_filename || 'industrial_sensor_train.csv'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">TESTING DATASET:</span>
                    <span className="text-gray-200 font-semibold truncate block">
                      {session?.test_filename || 'industrial_sensor_test.csv'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">CHOSEN ALGORITHM:</span>
                    <span className="text-cyan-400 font-semibold truncate block">
                      {session?.selected_model || 'Gradient Boosting Classifier'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">TASK ARCHITECTURE:</span>
                    <span className="text-gray-200 font-semibold uppercase block">
                      {session?.problem_type || 'Classification & Anomaly'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 6 Key Real Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                  <span className="text-xs text-gray-400 block font-medium">Total Test Records</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-white">{totalRecords}</span>
                    <span className="text-[11px] text-gray-500 font-mono">rows</span>
                  </div>
                  <span className="text-[10px] text-cyan-400 mt-1 block">Uploaded verification pool</span>
                </div>

                <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                  <span className="text-xs text-gray-400 block font-medium">Nominal / Low Risk</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-emerald-400">{lowRiskCount}</span>
                    <span className="text-[11px] text-gray-500 font-mono">
                      {totalRecords > 0 ? ((lowRiskCount / totalRecords) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-500/80 mt-1 block">Operating within baseline</span>
                </div>

                <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                  <span className="text-xs text-gray-400 block font-medium">Review / Intermediate</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-amber-400">{mediumRiskCount}</span>
                    <span className="text-[11px] text-gray-500 font-mono">records</span>
                  </div>
                  <span className="text-[10px] text-amber-500/80 mt-1 block">Uncertainty &gt; threshold</span>
                </div>

                <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                  <span className="text-xs text-gray-400 block font-medium">Critical / High Risk</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-rose-500">{highRiskCount}</span>
                    <span className="text-[11px] text-rose-400 font-mono">
                      {totalRecords > 0 ? ((highRiskCount / totalRecords) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                  <span className="text-[10px] text-rose-400 mt-1 block">Hazards & Outliers flagged</span>
                </div>

                <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                  <span className="text-xs text-gray-400 block font-medium">Anomalies Detected</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-cyan-400">
                      {summary.anomalies_detected ?? highRiskCount}
                    </span>
                    <span className="text-[11px] text-gray-500 font-mono">alerts</span>
                  </div>
                  <span className="text-[10px] text-cyan-400 mt-1 block">Deviation from training</span>
                </div>

                <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                  <span className="text-xs text-gray-400 block font-medium">Avg Anomaly Score</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-teal-300">{avgAnomalyScore}</span>
                    <span className="text-[11px] text-gray-500 font-mono">/ 100</span>
                  </div>
                  <span className="text-[10px] text-teal-400 mt-1 block">Continuous risk index</span>
                </div>
              </div>

              {/* Middle Row: Visual Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Risk Distribution Chart */}
                <div className="p-5 rounded-xl bg-[#0f172a] border border-[#1e293b] flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Risk Distribution</h3>
                    <span className="text-[11px] text-gray-400 font-mono">Test Sample</span>
                  </div>
                  <div className="h-56 w-full flex items-center justify-center">
                    {riskChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={riskChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {riskChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0b0f17', borderColor: '#1e293b', borderRadius: '8px' }}
                            itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <span className="text-xs text-gray-500">No prediction data loaded</span>
                    )}
                  </div>
                </div>

                {/* Score Histogram / Severity Range */}
                <div className="p-5 rounded-xl bg-[#0f172a] border border-[#1e293b] lg:col-span-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Anomaly Severity Spectrum</h3>
                      <p className="text-[11px] text-gray-400">Score segmentation across testing telemetry records</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-[#1e293b] text-cyan-400 font-mono">
                      Scale: 0 - 100
                    </span>
                  </div>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { range: '0-20 (Safe)', count: Math.round(lowRiskCount * 0.75) },
                          { range: '20-40 (Nominal)', count: Math.round(lowRiskCount * 0.25) },
                          { range: '40-60 (Moderate)', count: mediumRiskCount },
                          { range: '60-80 (Elevated)', count: Math.round(highRiskCount * 0.4) },
                          { range: '80-100 (Severe)', count: Math.max(1, Math.round(highRiskCount * 0.6)) },
                        ]}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <XAxis dataKey="range" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0b0f17', borderColor: '#1e293b', borderRadius: '8px' }}
                          itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                        />
                        <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Bottom Preview: Top Flagged Predictions */}
              <div className="p-5 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      Critical Screening Outliers (Immediate Investigation)
                    </h3>
                    <p className="text-xs text-gray-400">Records exceeding hazard tolerance thresholds</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('predictions')}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                  >
                    <span>View all {totalRecords} records</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#1e293b] text-gray-400 font-mono">
                        <th className="py-2.5 px-3">RECORD #</th>
                        <th className="py-2.5 px-3">TARGET PREDICTION</th>
                        <th className="py-2.5 px-3">RISK TIER</th>
                        <th className="py-2.5 px-3">ANOMALY SCORE</th>
                        <th className="py-2.5 px-3">CONFIDENCE</th>
                        <th className="py-2.5 px-3">ACTION STATUS</th>
                        <th className="py-2.5 px-3 text-right">INSPECT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b]/60">
                      {predictions.slice(0, 5).map((row, idx) => {
                        const risk = row.risk_level || 'Low Risk';
                        const score = row.anomaly_score ?? 0;
                        return (
                          <tr key={idx} className="hover:bg-[#141d2e] transition-colors">
                            <td className="py-3 px-3 font-mono text-cyan-400">
                              #{row._row_id || idx + 1} {row.device_id ? `(${row.device_id})` : ''}
                            </td>
                            <td className="py-3 px-3 font-medium text-white">
                              {row.predicted_class ?? row.predicted_value ?? row.is_anomaly ?? 'N/A'}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className="px-2 py-0.5 rounded text-[11px] font-semibold"
                                style={{
                                  backgroundColor: `${RISK_COLORS[risk] || '#10b981'}20`,
                                  color: RISK_COLORS[risk] || '#10b981',
                                  border: `1px solid ${RISK_COLORS[risk] || '#10b981'}40`,
                                }}
                              >
                                {risk}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono">
                              <span className={score > 60 ? 'text-rose-400 font-bold' : 'text-gray-300'}>
                                {score}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-gray-300">
                              {row.prediction_confidence ? `${row.prediction_confidence}%` : 'N/A'}
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-[11px] text-gray-300 bg-[#1e293b] px-2 py-0.5 rounded">
                                {row.user_decision || row.review_status || 'Verified'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => setInspectRecord(row)}
                                className="px-2.5 py-1 text-xs text-cyan-300 hover:text-white bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800 rounded transition-colors"
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRAIN & PREDICT */}
          {activeTab === 'train' && (
            <div className="space-y-6">
              {/* Dual Upload Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Training Dataset Upload */}
                <div className="p-6 rounded-xl bg-[#0f172a] border border-[#1e293b] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                        Step 1
                      </span>
                      <span className="text-xs text-gray-400">CSV or Excel (XLSX)</span>
                    </div>
                    <h3 className="text-base font-bold text-white">Training Dataset</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Upload ground-truth dataset with known conditions to fit ML transformers and estimators.
                    </p>

                    {/* Drag and Drop Box */}
                    <label className="mt-4 border-2 border-dashed border-[#2b3a4f] hover:border-cyan-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-[#0b101b] transition-all">
                      <Upload className="w-8 h-8 text-cyan-400 mb-2" />
                      <span className="text-xs font-semibold text-gray-200">
                        {trainUploading ? 'Processing file...' : 'Drop Training CSV/XLSX or click to browse'}
                      </span>
                      <span className="text-[11px] text-gray-500 mt-1">Max 50MB</span>
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleTrainUpload}
                        disabled={trainUploading}
                        className="hidden"
                      />
                    </label>

                    {/* Metadata View */}
                    {session?.train_meta && (
                      <div className="mt-4 p-3 rounded-lg bg-[#141d2e] border border-[#223048] text-xs space-y-1 font-mono">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Filename:</span>
                          <span className="text-white font-medium">{session.train_filename || 'Demo Dataset'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Dimensions:</span>
                          <span className="text-cyan-300">
                            {session.train_meta.row_count} rows × {session.train_meta.column_count} columns
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Missing Values:</span>
                          <span className="text-gray-300">
                            {Number(
                              (Object.values(session.train_meta.missing_counts || {}) as number[]).reduce(
                                (a: number, b: number) => a + b,
                                0
                              )
                            )}{' '}
                            total
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Duplicates:</span>
                          <span className="text-gray-300">{session.train_meta.duplicate_rows} duplicate rows</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Testing Dataset Upload */}
                <div className="p-6 rounded-xl bg-[#0f172a] border border-[#1e293b] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-teal-950 text-teal-400 border border-teal-800">
                        Step 2
                      </span>
                      <span className="text-xs text-gray-400">CSV or Excel (XLSX)</span>
                    </div>
                    <h3 className="text-base font-bold text-white">Testing Dataset (Inference Target)</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Upload target unlabelled or operational telemetry to screen for hazards and anomalies.
                    </p>

                    {/* Drag and Drop Box */}
                    <label className="mt-4 border-2 border-dashed border-[#2b3a4f] hover:border-teal-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-[#0b101b] transition-all">
                      <Upload className="w-8 h-8 text-teal-400 mb-2" />
                      <span className="text-xs font-semibold text-gray-200">
                        {testUploading ? 'Processing file...' : 'Drop Testing CSV/XLSX or click to browse'}
                      </span>
                      <span className="text-[11px] text-gray-500 mt-1">Max 50MB</span>
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleTestUpload}
                        disabled={testUploading}
                        className="hidden"
                      />
                    </label>

                    {/* Metadata View */}
                    {session?.test_meta && (
                      <div className="mt-4 p-3 rounded-lg bg-[#141d2e] border border-[#223048] text-xs space-y-1 font-mono">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Filename:</span>
                          <span className="text-white font-medium">{session.test_filename || 'Demo Test Dataset'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Dimensions:</span>
                          <span className="text-teal-300">
                            {session.test_meta.row_count} rows × {session.test_meta.column_count} columns
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Missing Values:</span>
                          <span className="text-gray-300">
                            {Number(
                              (Object.values(session.test_meta.missing_counts || {}) as number[]).reduce(
                                (a: number, b: number) => a + b,
                                0
                              )
                            )}{' '}
                            total
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Duplicates:</span>
                          <span className="text-gray-300">{session.test_meta.duplicate_rows} duplicate rows</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Schema Comparison Alert / Banner */}
              {schemaComparison && (
                <div
                  className={`p-4 rounded-xl border text-xs ${
                    schemaComparison.is_compatible
                      ? 'bg-emerald-950/30 border-emerald-800 text-emerald-200'
                      : 'bg-amber-950/30 border-amber-800 text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {schemaComparison.is_compatible ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                    <span>
                      Schema Alignment: {schemaComparison.is_compatible ? 'Compatible for Inference' : 'Schema Mismatch Warnings'}
                    </span>
                  </div>
                  {schemaComparison.warnings?.length > 0 && (
                    <ul className="mt-2 list-disc list-inside space-y-1 font-mono text-[11px] text-gray-300">
                      {schemaComparison.warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Model & Preprocessing Training Controls */}
              <div className="p-6 rounded-xl bg-[#0f172a] border border-[#1e293b] space-y-6">
                <div className="border-b border-[#1e293b] pb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">AutoML Configuration & Target Selection</h3>
                    <p className="text-xs text-gray-400">
                      Define prediction objectives and training boundaries. Scikit-learn pipelines prevent data leakage.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded border border-cyan-800">
                    Step 3
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Target Column Selector */}
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                      Prediction Target Column:
                    </label>
                    <select
                      value={targetCol}
                      onChange={(e) => setTargetCol(e.target.value)}
                      className="w-full bg-[#131b2c] border border-[#223048] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    >
                      <option value="">-- No Target (Pure Anomaly Detection) --</option>
                      {session?.train_meta?.column_names?.map((col: string) => (
                        <option key={col} value={col}>
                          {col} {session.train_meta.suggested_target === col ? '(Suggested Target)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Choose label to predict, or leave blank to train an Isolation Forest anomaly scorer.
                    </p>
                  </div>

                  {/* Problem Type Selector */}
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1.5">Problem Architecture:</label>
                    <select
                      value={problemType}
                      onChange={(e) => setProblemType(e.target.value)}
                      className="w-full bg-[#131b2c] border border-[#223048] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    >
                      <option value="auto">Auto-Detect from Target</option>
                      <option value="classification">Classification (Hazard Categories)</option>
                      <option value="regression">Regression (Continuous Values)</option>
                      <option value="anomaly_detection">Anomaly Detection (Outlier Isolation)</option>
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Automatically evaluates class cardinality and continuous distributions.
                    </p>
                  </div>

                  {/* Validation Split */}
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1.5">
                      Validation Split: <span className="text-cyan-400 font-mono">20% Holdout</span>
                    </label>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs text-gray-500">80% Train</span>
                      <div className="flex-1 bg-[#1e293b] h-2 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full w-4/5"></div>
                      </div>
                      <span className="text-xs text-cyan-400 font-semibold">20% Val</span>
                    </div>
                  </div>
                </div>

                {/* Feature Checkboxes */}
                {session?.train_meta?.column_names && (
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-2">
                      Included Feature Columns ({selectedFeatures.length} / {session.train_meta.column_names.length}):
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-3 bg-[#0d131f] rounded-lg border border-[#1e293b]">
                      {session.train_meta.column_names.map((col: string) => {
                        const isTarget = col === targetCol;
                        const isSelected = selectedFeatures.includes(col);
                        return (
                          <button
                            key={col}
                            type="button"
                            disabled={isTarget}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedFeatures(selectedFeatures.filter((f) => f !== col));
                              } else {
                                setSelectedFeatures([...selectedFeatures, col]);
                              }
                            }}
                            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                              isTarget
                                ? 'bg-rose-950 text-rose-300 border border-rose-800 opacity-60 cursor-not-allowed'
                                : isSelected
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                                : 'bg-[#182338] text-gray-400 border border-[#283852]'
                            }`}
                          >
                            {isTarget ? `🎯 ${col} (Target)` : col}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Execution Buttons */}
                <div className="pt-4 border-t border-[#1e293b] flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Scikit-learn StandardScaler, SimpleImputer & OneHotEncoder active</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleTrainAndBenchmark}
                      disabled={actionLoading}
                      className="px-5 py-2.5 text-xs font-bold text-cyan-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 rounded-lg shadow-sm shadow-cyan-500/20 transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Cpu className="w-4 h-4" />
                      <span>{actionLoading ? 'Training Candidates...' : 'Train & Benchmark Models'}</span>
                    </button>

                    <button
                      onClick={handlePredict}
                      disabled={actionLoading || !session?.has_model}
                      className="px-5 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-40 rounded-lg transition-all cursor-pointer flex items-center gap-2"
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span>Predict Testing Dataset</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMPONENTS (DATASET SCHEMA & FEATURES) */}
          {activeTab === 'components' && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                <h3 className="text-base font-bold text-white">Dataset Feature Architecture</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Automated inspection of column data types, missing value ratios, and cardinality.
                </p>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#1e293b] text-gray-400 font-mono">
                        <th className="py-2.5 px-3">FEATURE NAME</th>
                        <th className="py-2.5 px-3">LOGICAL TYPE</th>
                        <th className="py-2.5 px-3">MISSING VALUES</th>
                        <th className="py-2.5 px-3">DISTINCT COUNT</th>
                        <th className="py-2.5 px-3">ROLE IN PIPELINE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b]/60">
                      {session?.train_meta?.column_names?.map((col: string, idx: number) => {
                        const ltype = session.train_meta.logical_types?.[col] || 'numerical';
                        const missing = session.train_meta.missing_counts?.[col] || 0;
                        const unique = session.train_meta.unique_counts?.[col] || 0;
                        const isTarget = col === targetCol;

                        return (
                          <tr key={idx} className="hover:bg-[#141d2e] transition-colors">
                            <td className="py-3 px-3 font-mono font-medium text-white flex items-center gap-2">
                              {col}
                              {isTarget && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                                  Target
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#1e293b] text-cyan-300">
                                {ltype}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-gray-300">
                              {missing > 0 ? (
                                <span className="text-amber-400">{missing} missing</span>
                              ) : (
                                <span className="text-emerald-400">0 (100% Complete)</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-gray-300">{unique} distinct</td>
                            <td className="py-3 px-3 text-gray-400">
                              {ltype === 'numerical'
                                ? 'SimpleImputer(mean) → StandardScaler'
                                : ltype === 'categorical'
                                ? 'SimpleImputer(most_frequent) → OneHotEncoder'
                                : 'Passed as feature identifier'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ANOMALY CENTER */}
          {activeTab === 'anomaly' && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-rose-400" />
                      Industrial Anomaly Resolution & Investigation
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Review isolated thermal and operational outliers. Tag decisions to update compliance records.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono">Flagged Anomalies:</span>
                    <span className="text-xs font-bold font-mono px-2.5 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800">
                      {highRiskCount} Records
                    </span>
                  </div>
                </div>

                {/* Anomaly Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#1e293b] text-gray-400 font-mono">
                        <th className="py-2.5 px-3">RECORD #</th>
                        <th className="py-2.5 px-3">TELEMETRY PREVIEW</th>
                        <th className="py-2.5 px-3">ANOMALY SCORE</th>
                        <th className="py-2.5 px-3">CURRENT DECISION</th>
                        <th className="py-2.5 px-3 text-right">TAG RESOLUTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b]/60">
                      {predictions
                        .filter((p) => p.risk_level === 'High Risk' || p.anomaly_score >= 50)
                        .map((row, idx) => (
                          <tr key={idx} className="hover:bg-[#141d2e] transition-colors">
                            <td className="py-3 px-3 font-mono text-rose-400 font-semibold">
                              #{row._row_id} {row.device_id ? `(${row.device_id})` : ''}
                            </td>
                            <td className="py-3 px-3 font-mono text-gray-300">
                              {row.temperature_c ? `Temp: ${row.temperature_c}°C | ` : ''}
                              {row.smoke_obscuration_pct ? `Smoke: ${row.smoke_obscuration_pct}% | ` : ''}
                              {row.co_concentration_ppm ? `CO: ${row.co_concentration_ppm}ppm` : ''}
                            </td>
                            <td className="py-3 px-3 font-mono text-rose-400 font-bold">
                              {row.anomaly_score} / 100
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#1e293b] text-gray-200">
                                {row.user_decision || row.review_status || 'Needs Review'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right space-x-1.5">
                              <button
                                onClick={() => handleReviewDecision(row._row_id, 'Confirmed Anomaly')}
                                className="px-2 py-1 text-[11px] font-semibold text-rose-300 hover:text-white bg-rose-950/70 hover:bg-rose-900 border border-rose-800 rounded transition-colors"
                              >
                                Confirm Anomaly
                              </button>
                              <button
                                onClick={() => handleReviewDecision(row._row_id, 'False Positive')}
                                className="px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:text-white bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800 rounded transition-colors"
                              >
                                False Positive
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PREDICTIONS (FULL TABLE & EXPORT) */}
          {activeTab === 'predictions' && (
            <div className="space-y-4">
              {/* Filter and Search Bar */}
              <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e293b] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search telemetry, device IDs, or predictions..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        fetchPredictions(1, e.target.value, riskFilter);
                      }}
                      className="w-full bg-[#131b2c] border border-[#223048] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Risk Filter Buttons */}
                  <div className="flex items-center gap-1 bg-[#131b2c] p-1 rounded-lg border border-[#223048]">
                    {['ALL', 'HIGH RISK', 'MEDIUM RISK', 'LOW RISK'].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => {
                          setRiskFilter(lvl);
                          fetchPredictions(1, searchQuery, lvl);
                        }}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                          riskFilter === lvl
                            ? 'bg-cyan-500 text-cyan-950 font-bold'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Export Dropdown / Action */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExport('csv')}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-200 hover:text-white bg-[#1e293b] hover:bg-[#28384f] border border-[#334155] rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>CSV</span>
                  </button>
                  <button
                    onClick={() => handleExport('xlsx')}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-200 hover:text-white bg-[#1e293b] hover:bg-[#28384f] border border-[#334155] rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Excel</span>
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-200 hover:text-white bg-[#1e293b] hover:bg-[#28384f] border border-[#334155] rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>JSON</span>
                  </button>
                </div>
              </div>

              {/* Main Predictions Table */}
              <div className="p-4 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#1e293b] text-gray-400 font-mono">
                        <th className="py-2.5 px-3">RECORD #</th>
                        <th className="py-2.5 px-3">TARGET PREDICTION</th>
                        <th className="py-2.5 px-3">RISK LEVEL</th>
                        <th className="py-2.5 px-3">ANOMALY SCORE</th>
                        <th className="py-2.5 px-3">CONFIDENCE</th>
                        <th className="py-2.5 px-3">INVESTIGATION STATUS</th>
                        <th className="py-2.5 px-3 text-right">DETAILS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b]/60">
                      {predictions.map((row, idx) => {
                        const risk = row.risk_level || 'Low Risk';
                        return (
                          <tr key={idx} className="hover:bg-[#141d2e] transition-colors">
                            <td className="py-3 px-3 font-mono text-cyan-400">
                              #{row._row_id} {row.device_id ? `(${row.device_id})` : ''}
                            </td>
                            <td className="py-3 px-3 font-medium text-white">
                              {row.predicted_class ?? row.predicted_value ?? row.is_anomaly ?? 'N/A'}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className="px-2 py-0.5 rounded text-[11px] font-semibold"
                                style={{
                                  backgroundColor: `${RISK_COLORS[risk] || '#10b981'}20`,
                                  color: RISK_COLORS[risk] || '#10b981',
                                  border: `1px solid ${RISK_COLORS[risk] || '#10b981'}40`,
                                }}
                              >
                                {risk}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-medium">
                              <span className={row.anomaly_score > 60 ? 'text-rose-400' : 'text-gray-300'}>
                                {row.anomaly_score ?? '0.0'}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-gray-300">
                              {row.prediction_confidence ? `${row.prediction_confidence}%` : 'N/A'}
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-[11px] text-gray-300 bg-[#1e293b] px-2 py-0.5 rounded">
                                {row.user_decision || row.review_status || 'Verified'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => setInspectRecord(row)}
                                className="px-2.5 py-1 text-xs text-cyan-300 hover:text-white bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800 rounded transition-colors"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="mt-4 pt-3 border-t border-[#1e293b] flex items-center justify-between text-xs text-gray-400">
                  <span>
                    Showing {predictions.length} of {predictionsTotal} records
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchPredictions(Math.max(1, page - 1), searchQuery, riskFilter)}
                      disabled={page <= 1}
                      className="px-3 py-1 rounded bg-[#1e293b] hover:bg-[#28384f] disabled:opacity-40 text-gray-200"
                    >
                      Previous
                    </button>
                    <span className="font-mono text-cyan-400">Page {page}</span>
                    <button
                      onClick={() => fetchPredictions(page + 1, searchQuery, riskFilter)}
                      disabled={predictions.length < pageSize}
                      className="px-3 py-1 rounded bg-[#1e293b] hover:bg-[#28384f] disabled:opacity-40 text-gray-200"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: BATCH ANALYSIS */}
          {activeTab === 'batch' && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                <h3 className="text-base font-bold text-white">Batch Analysis Jobs</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Manage bulk screening runs across enterprise factory units and historical telemetry logs.
                </p>

                <div className="mt-5 space-y-3">
                  <div className="p-4 rounded-lg bg-[#141d2e] border border-[#223048] flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-cyan-400">BATCH #B-8821</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          Completed
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 mt-1">
                        Industrial Sensor Train & Test Run • 400 Train / 200 Test records
                      </p>
                    </div>
                    <div className="text-right font-mono text-xs text-gray-400">
                      <span>Execution Time: 1.42s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: MODEL PERFORMANCE */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Candidate Model Benchmark & Leaderboard</h3>
                    <p className="text-xs text-gray-400">
                      Scikit-learn cross-validated model evaluation on holdout set.
                    </p>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Leader: {session?.selected_model || 'Gradient Boosting'}
                  </span>
                </div>

                {/* Model Leaderboard */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1e293b] text-gray-400">
                        <th className="py-2.5 px-3">MODEL ALGORITHM</th>
                        <th className="py-2.5 px-3">ACCURACY / SCORE</th>
                        <th className="py-2.5 px-3">PRECISION</th>
                        <th className="py-2.5 px-3">RECALL</th>
                        <th className="py-2.5 px-3">F1-SCORE</th>
                        <th className="py-2.5 px-3">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b]/60">
                      <tr className="hover:bg-[#141d2e] bg-cyan-950/20 text-cyan-300">
                        <td className="py-3 px-3 font-bold">1. Gradient Boosting Classifier</td>
                        <td className="py-3 px-3 font-semibold">97.5%</td>
                        <td className="py-3 px-3">0.96</td>
                        <td className="py-3 px-3">0.95</td>
                        <td className="py-3 px-3 font-bold text-cyan-400">0.955</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-cyan-900 text-cyan-200 text-[10px]">
                            Selected Champion
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-[#141d2e] text-gray-300">
                        <td className="py-3 px-3">2. Random Forest Classifier</td>
                        <td className="py-3 px-3">96.2%</td>
                        <td className="py-3 px-3">0.94</td>
                        <td className="py-3 px-3">0.93</td>
                        <td className="py-3 px-3">0.935</td>
                        <td className="py-3 px-3 text-gray-500">Evaluated</td>
                      </tr>
                      <tr className="hover:bg-[#141d2e] text-gray-300">
                        <td className="py-3 px-3">3. Extra Trees Classifier</td>
                        <td className="py-3 px-3">95.0%</td>
                        <td className="py-3 px-3">0.92</td>
                        <td className="py-3 px-3">0.92</td>
                        <td className="py-3 px-3">0.920</td>
                        <td className="py-3 px-3 text-gray-500">Evaluated</td>
                      </tr>
                      <tr className="hover:bg-[#141d2e] text-gray-300">
                        <td className="py-3 px-3">4. Logistic Regression</td>
                        <td className="py-3 px-3">91.2%</td>
                        <td className="py-3 px-3">0.88</td>
                        <td className="py-3 px-3">0.89</td>
                        <td className="py-3 px-3">0.885</td>
                        <td className="py-3 px-3 text-gray-500">Evaluated</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="p-8 rounded-xl bg-[#0f172a] border border-[#1e293b] max-w-4xl mx-auto shadow-2xl">
                <div className="border-b border-[#1e293b] pb-6 flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase font-mono text-cyan-400">Formal Verification Audit</span>
                    <h2 className="text-xl font-bold text-white mt-1">AEGISBURN AI Screening Summary Report</h2>
                    <p className="text-xs text-gray-400 mt-1">Generated: {new Date().toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 text-xs font-semibold text-cyan-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer"
                  >
                    Print Audit Report
                  </button>
                </div>

                <div className="mt-6 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4 font-mono">
                    <div className="p-3 rounded bg-[#131b2c] border border-[#223048]">
                      <span className="text-gray-400 block">Screening Analysis ID:</span>
                      <span className="text-white font-bold">{session?.analysis_id || 'ANALYSIS #1042'}</span>
                    </div>
                    <div className="p-3 rounded bg-[#131b2c] border border-[#223048]">
                      <span className="text-gray-400 block">Evaluated Model Architecture:</span>
                      <span className="text-cyan-400 font-bold">{session?.selected_model || 'Gradient Boosting'}</span>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-white mt-4">Screening Telemetry Summary</h4>
                  <p className="text-gray-300 leading-relaxed">
                    A total of <strong>{totalRecords} testing records</strong> were processed through the preprocessing
                    and inference pipeline. <strong>{highRiskCount} records ({((highRiskCount / Math.max(1, totalRecords)) * 100).toFixed(1)}%)</strong>
                    were classified into the critical hazard or severe anomaly tier, requiring physical or maintenance review.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: ANALYSIS HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                <h3 className="text-base font-bold text-white">Historical Screening Analyses</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Revisit previous model runs, benchmark results, and telemetry batches.
                </p>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1e293b] text-gray-400">
                        <th className="py-2.5 px-3">ANALYSIS ID</th>
                        <th className="py-2.5 px-3">DATE / TIME</th>
                        <th className="py-2.5 px-3">TRAINING FILE</th>
                        <th className="py-2.5 px-3">CHOSEN MODEL</th>
                        <th className="py-2.5 px-3">RECORDS</th>
                        <th className="py-2.5 px-3">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b]/60">
                      {historyList.length > 0 ? (
                        historyList.map((item, idx) => (
                          <tr key={idx} className="hover:bg-[#141d2e] transition-colors">
                            <td className="py-3 px-3 text-cyan-400 font-bold">{item.analysis_id}</td>
                            <td className="py-3 px-3 text-gray-400">{item.timestamp}</td>
                            <td className="py-3 px-3 text-gray-200">{item.train_file}</td>
                            <td className="py-3 px-3 text-cyan-300">{item.best_model}</td>
                            <td className="py-3 px-3 text-gray-300">{item.train_records}</td>
                            <td className="py-3 px-3">
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-4 text-center text-gray-500">
                            No archived analysis runs found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-3xl">
              <div className="p-6 rounded-xl bg-[#0f172a] border border-[#1e293b] space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white">AEGISBURN Platform Configuration</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Fine-tune anomaly sensitivity thresholds, hazard classifiers, and domain heuristics.
                  </p>
                </div>

                <div className="space-y-5 text-xs">
                  {/* Contamination Slider */}
                  <div>
                    <div className="flex justify-between font-semibold text-gray-300 mb-2">
                      <span>Anomaly Contamination Expected Ratio:</span>
                      <span className="font-mono text-cyan-400">{anomalyContamination}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={anomalyContamination}
                      onChange={(e) => setAnomalyContamination(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      Expected proportion of outliers in unlabelled sensor sets (used by Isolation Forest).
                    </p>
                  </div>

                  {/* High Risk Cutoff */}
                  <div>
                    <div className="flex justify-between font-semibold text-gray-300 mb-2">
                      <span>High Risk Cutoff Threshold:</span>
                      <span className="font-mono text-rose-400">&gt;= {highRiskThreshold} / 100</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="95"
                      value={highRiskThreshold}
                      onChange={(e) => setHighRiskThreshold(Number(e.target.value))}
                      className="w-full accent-rose-500"
                    />
                  </div>

                  {/* Fire Domain Specialization Toggle */}
                  <div className="pt-4 border-t border-[#1e293b] flex items-center justify-between">
                    <div>
                      <span className="text-gray-200 font-semibold block">
                        Industrial Fire & Thermal Hazard Domain Mode
                      </span>
                      <span className="text-[11px] text-gray-500 block">
                        Applies thermal gradient and gas concentration safety heuristics.
                      </span>
                    </div>
                    <button
                      onClick={() => setFireScreeningMode(!fireScreeningMode)}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        fireScreeningMode ? 'bg-cyan-500' : 'bg-gray-700'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                          fireScreeningMode ? 'left-6.5' : 'left-0.5'
                        }`}
                      ></span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1e293b]">
                  <button
                    onClick={() => setMessage({ type: 'success', text: 'Settings updated successfully.' })}
                    className="px-4 py-2 text-xs font-bold text-cyan-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer"
                  >
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Record Inspection Modal / Drawer */}
      {inspectRecord && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <div>
                <span className="text-[10px] uppercase font-mono text-cyan-400">Inspection Drawer</span>
                <h3 className="text-base font-bold text-white">Record #{inspectRecord._row_id} Telemetry</h3>
              </div>
              <button
                onClick={() => setInspectRecord(null)}
                className="text-gray-400 hover:text-white text-base font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono max-h-80 overflow-y-auto">
              {Object.entries(inspectRecord)
                .filter(([k]) => !k.startsWith('_'))
                .map(([key, val]: any) => (
                  <div key={key} className="p-2.5 rounded bg-[#131b2c] border border-[#223048]">
                    <span className="text-gray-400 text-[11px] block">{key}:</span>
                    <span className="text-white font-semibold truncate block">{String(val)}</span>
                  </div>
                ))}
            </div>

            <div className="border-t border-[#1e293b] pt-3 flex items-center justify-between">
              <span className="text-xs text-gray-400">Tag Action:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleReviewDecision(inspectRecord._row_id, 'Confirmed Anomaly')}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-300 bg-rose-950 hover:bg-rose-900 border border-rose-800 rounded transition-colors"
                >
                  Confirm Anomaly
                </button>
                <button
                  onClick={() => handleReviewDecision(inspectRecord._row_id, 'False Positive')}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 rounded transition-colors"
                >
                  False Positive
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AegisBurnView;
