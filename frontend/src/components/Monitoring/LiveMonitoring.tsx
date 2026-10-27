import React, { useState, useEffect } from 'react';
import { Camera, Play, Square, AlertTriangle } from 'lucide-react';
import VideoFeed from './VideoFeed';
import { camerasApi, sessionsApi, modelsApi } from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Camera as CameraType } from '../../types';

const LiveMonitoring = () => {
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [modelReady, setModelReady] = useState(false);
  
  const { isConnected, detections, metrics, frameData } = useWebSocket(sessionId);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    camerasApi.list().then(res => {
      setCameras(res.data);
      if (res.data && res.data.length > 0 && !selectedCamera) {
        setSelectedCamera(String(res.data[0].id));
      }
    }).catch(console.error);
    modelsApi.getStatus().then(res => setModelReady(res.data.is_ready)).catch(console.error);
  }, []);

  const handleStart = async () => {
    if (!selectedCamera) {
      setErrorMsg("Please select a camera first.");
      return;
    }
    setErrorMsg(null);
    try {
      const res = await sessionsApi.create({ camera_id: parseInt(selectedCamera) });
      setSessionId(res.data.id);
    } catch (err: any) {
      console.error("Failed to start session", err);
      const detail = err?.response?.data?.detail || err?.message || "Failed to start monitoring session";
      setErrorMsg(detail);
    }
  };

  const handleStop = async () => {
    if (!sessionId) return;
    try {
      await sessionsApi.stop(sessionId);
      setSessionId(null);
    } catch (err) {
      console.error("Failed to stop session", err);
    }
  };

  const activeCam = cameras.find(c => String(c.id) === selectedCamera);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      <div className="flex-1 flex flex-col gap-4">
        <div className="card p-4 flex justify-between items-center flex-wrap gap-4">
          <div className="flex gap-4 items-center flex-wrap">
            <select 
              className="border border-gray-300 rounded-lg p-2 min-w-[200px]"
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              disabled={!!sessionId}
            >
              <option value="">Select Camera...</option>
              {cameras.map((cam: any) => (
                <option key={cam.id} value={cam.id}>{cam.name}</option>
              ))}
            </select>
            {!sessionId ? (
              <button 
                onClick={handleStart} 
                disabled={!selectedCamera || !modelReady}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Play className="w-4 h-4" /> Start Monitoring
              </button>
            ) : (
              <button 
                onClick={handleStop}
                className="btn-danger flex items-center gap-2"
              >
                <Square className="w-4 h-4" /> Stop Monitoring
              </button>
            )}

            {/* Active Camera Safety Profile Badges */}
            {activeCam?.safety_profile && (
              <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
                <span className="font-semibold text-slate-700">Enforced PPE:</span>
                <div className="flex gap-1.5">
                  {activeCam.safety_profile.required_ppe.map((item: string, idx: number) => (
                    <span key={idx} className="bg-white border border-slate-300 font-medium text-slate-800 px-2 py-0.5 rounded shadow-2xs">
                      {item === 'mask' ? '😷 Mask' : item === 'helmet' ? '⛑️ Helmet' : item === 'vest' ? '🦺 Vest' : item === 'gloves' ? '🧤 Gloves' : item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {errorMsg && (
              <span className="text-sm text-red-500 font-medium">{errorMsg}</span>
            )}
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className="text-sm font-medium">WS Status</span>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-black rounded-lg overflow-hidden relative border border-gray-800 flex items-center justify-center">
          {sessionId ? (
            <VideoFeed frameData={frameData} detections={detections} />
          ) : (
            <div className="text-gray-500 flex flex-col items-center">
              <Camera className="w-16 h-16 mb-4 opacity-50" />
              <p>Select a camera and start monitoring</p>
            </div>
          )}
        </div>
      </div>

      <div className="w-80 flex flex-col gap-4">
        <div className="card flex-shrink-0">
          <h3 className="font-semibold mb-4 border-b pb-2">Session Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">FPS</span>
              <span className="font-medium">{metrics?.fps?.toFixed(1) || '0.0'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Latency</span>
              <span className="font-medium">{metrics?.latency_ms?.toFixed(0) || '0'} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Detections</span>
              <span className="font-medium">{metrics?.detections_count || 0}</span>
            </div>
          </div>
        </div>

        <div className="card flex-1 flex flex-col overflow-hidden">
          <h3 className="font-semibold mb-2 border-b pb-2">Recent Detections</h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {detections.length === 0 && <div className="text-sm text-gray-500 p-2">No detections in current frame</div>}
            {detections.map((d, i) => (
              <div key={i} className="bg-gray-50 p-2 rounded flex justify-between items-center text-sm border border-gray-100">
                <span className="font-medium capitalize">{d.class_name.replace('_', ' ')}</span>
                <span className="text-gray-500">{(d.confidence * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMonitoring;
