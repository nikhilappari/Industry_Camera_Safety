import React, { useState, useEffect } from 'react';
import { modelsApi, systemApi } from '../../services/api';
import { ModelStatus } from '../../types';
import { Server, Cpu, Database, RefreshCw } from 'lucide-react';

const AdminPanel = () => {
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [loadingModel, setLoadingModel] = useState(false);

  useEffect(() => {
    fetchModelStatus();
  }, []);

  const fetchModelStatus = async () => {
    try {
      const res = await modelsApi.getStatus();
      setModelStatus(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReloadModel = async () => {
    setLoadingModel(true);
    try {
      await modelsApi.reload();
      await fetchModelStatus();
    } catch (err) {
      console.error("Failed to reload model", err);
    } finally {
      setLoadingModel(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">System Administration</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-gray-500" />
              <h3 className="text-lg font-semibold">AI Model Status</h3>
            </div>
            <button 
              onClick={handleReloadModel} 
              disabled={loadingModel}
              className="btn-secondary text-sm py-1.5 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loadingModel ? 'animate-spin' : ''}`} />
              Reload Model
            </button>
          </div>
          
          {modelStatus ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                <span className="text-gray-500 font-medium">Status</span>
                <span className={`col-span-2 font-medium ${modelStatus.is_ready ? 'text-green-600' : 'text-red-600'}`}>
                  {modelStatus.is_ready ? 'Ready / Loaded' : 'Not Ready'}
                </span>
              </div>
              <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                <span className="text-gray-500 font-medium">Repository</span>
                <span className="col-span-2 font-mono bg-gray-50 px-2 py-1 rounded truncate">{modelStatus.repository_id}</span>
              </div>
              <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                <span className="text-gray-500 font-medium">Revision</span>
                <span className="col-span-2">{modelStatus.revision || 'main'}</span>
              </div>
              <div className="grid grid-cols-3 py-2 border-b border-gray-50">
                <span className="text-gray-500 font-medium">Compute Device</span>
                <span className="col-span-2 uppercase font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full inline-block w-max">
                  {modelStatus.device}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-center py-4">Loading model status...</div>
          )}
        </div>

        <div className="card space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-gray-500" />
              <h3 className="text-lg font-semibold">System Health</h3>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 text-green-800 rounded-lg border border-green-100">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="font-medium flex-1">API Backend</span>
              <span className="text-sm bg-green-100 px-2 py-0.5 rounded">Healthy</span>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-green-50 text-green-800 rounded-lg border border-green-100">
              <Database className="w-4 h-4 text-green-600" />
              <span className="font-medium flex-1">Database Connection</span>
              <span className="text-sm bg-green-100 px-2 py-0.5 rounded">Healthy</span>
            </div>
            
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">System Configuration</h4>
              <div className="text-xs text-gray-500 space-y-1">
                <p>• Max FPS per session: 15</p>
                <p>• Incident retention: 90 days</p>
                <p>• Video storage path: /storage/video</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
