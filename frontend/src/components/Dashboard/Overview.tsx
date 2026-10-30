import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertOctagon, Video, CheckCircle2, Flame, ArrowRight, ShieldCheck, Cpu } from 'lucide-react';
import StatsCard from './StatsCard';
import IncidentTrendChart from './IncidentTrendChart';
import { analyticsApi, modelsApi } from '../../services/api';
import { AnalyticsSummary, ModelStatus } from '../../types';

const Overview = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sumRes, modRes] = await Promise.all([
          analyticsApi.getSummary(),
          modelsApi.getStatus()
        ]);
        setSummary(sumRes.data);
        setModelStatus(modRes.data);
      } catch (err) {
        console.error("Failed to fetch overview data", err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!summary) return <div className="p-4">Loading dashboard...</div>;

  return (
    <div className="space-y-6">
      {/* Top Banner: AEGISBURN AI Feature Promotion */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-gray-950 via-slate-900 to-gray-900 border border-gray-800 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold">
              NEW ML PLATFORM
            </span>
            <span className="text-xs text-gray-400">Automated Telemetry & Hazard Screening</span>
          </div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-cyan-400" />
            AEGISBURN AI — Data Screening, Anomaly Detection & Prediction
          </h2>
          <p className="text-xs text-gray-400 max-w-2xl">
            Train candidate models on your custom datasets, screen for thermal hazards & sensor drift,
            inspect tabular predictions, and download formal compliance audit reports.
          </p>
        </div>
        <button
          onClick={() => navigate('/aegis-burn')}
          className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-cyan-950 font-bold text-xs tracking-wide shadow-md shadow-cyan-500/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <span>Launch AEGISBURN AI</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard Overview</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Active Cameras" value={summary.total_cameras} icon={Video} color="cyan" />
        <StatsCard title="Open Incidents" value={summary.open_incidents} icon={Activity} color="yellow" />
        <StatsCard title="High Risk Incidents" value={summary.high_risk_incidents} icon={AlertOctagon} color="red" />
        <StatsCard title="Active Sessions" value={summary.active_sessions} icon={CheckCircle2} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <h3 className="text-lg font-semibold mb-4">Incident Trends (Last 7 Days)</h3>
          <div className="h-80">
            <IncidentTrendChart />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Model Status</h3>
            {modelStatus ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`font-medium ${modelStatus.is_ready ? 'text-green-600' : 'text-red-600'}`}>
                    {modelStatus.is_ready ? 'Ready' : 'Not Ready'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Device</span>
                  <span className="font-medium text-gray-900">{modelStatus.device}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Model</span>
                  <span className="font-medium text-gray-900 truncate max-w-[150px]" title={modelStatus.repository_id}>
                    {modelStatus.repository_id.split('/').pop()}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">Loading model status...</div>
            )}
          </div>
          
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Recent Incidents</h3>
            <div className="space-y-4">
              {summary.recent_incidents?.slice(0, 5).map(inc => (
                <div key={inc.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                  <div>
                    <div className="font-medium text-sm">
                      {inc.violation_type === 'missing_mask' ? '😷 Missing Face Mask' :
                       inc.violation_type === 'missing_gloves' ? '🧤 Missing Sterile Gloves' :
                       inc.violation_type === 'missing_helmet' ? '⛑️ Missing Hardhat' :
                       inc.violation_type === 'missing_vest' ? '🦺 Missing Safety Vest' :
                       inc.violation_type === 'restricted_zone' ? '⚠️ Restricted Zone' :
                       inc.violation_type.replace('_', ' ')}
                    </div>
                    <div className="text-xs text-gray-500">{new Date(inc.first_seen).toLocaleString()}</div>
                  </div>
                  <span className={`badge badge-${inc.severity.toLowerCase()}`}>{inc.severity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
