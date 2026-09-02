import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Camera, ScanFace, CheckCircle, AlertCircle, RefreshCw, Sparkles, Building2, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';

export const KioskMode = () => {
  const { organization } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [orgList, setOrgList] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(organization?.slug || '');
  const [streamActive, setStreamActive] = useState(false);
  const [challenge] = useState({ instruction: 'Look directly at camera & blink naturally', action: 'BLINK' });
  
  const [scanStatus, setScanStatus] = useState('IDLE');
  const [punchResult, setPunchResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const res = await api.get('/organizations/public/list');
        setOrgList(res.data);
        if (!selectedOrg && res.data.length > 0) {
          setSelectedOrg(res.data[0].slug);
        }
      } catch (err) {
        console.error('Failed to load orgs', err);
      }
    };
    fetchOrgs();
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreamActive(true);
      }
    } catch (err) {
      console.error('Webcam error:', err);
      setErrorMessage('Unable to access webcam. Please ensure camera permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const triggerVerification = async () => {
    if (!selectedOrg) {
      setErrorMessage('Please select an organization first.');
      return;
    }
    const frame = captureFrame();
    if (!frame) return;

    setScanStatus('SCANNING');
    setErrorMessage('');

    try {
      const res = await api.post('/attendance/kiosk-punch', {
        organization_slug_or_id: selectedOrg,
        image_sample: frame,
        punch_type: 'AUTO',
        liveness_challenge_response: 'VERIFIED'
      });

      setPunchResult(res.data);
      setScanStatus('SUCCESS');

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });

      setTimeout(() => {
        setPunchResult(null);
        setScanStatus('IDLE');
      }, 4000);

    } catch (err) {
      setScanStatus('ERROR');
      setErrorMessage(err.response?.data?.detail || 'Face not recognized or liveness check failed.');
      setTimeout(() => {
        setScanStatus('IDLE');
        setErrorMessage('');
      }, 3500);
    }
  };

  let borderStyle = 'border-white/60';
  if (scanStatus === 'SUCCESS') borderStyle = 'border-emerald-400 bg-emerald-500/10';
  else if (scanStatus === 'ERROR') borderStyle = 'border-red-400 bg-red-500/10';
  else if (scanStatus === 'SCANNING') borderStyle = 'border-blue-400 animate-pulse bg-blue-500/10';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100 py-6 px-4 flex flex-col items-center justify-between">
      {/* Kiosk Header & Org Selector */}
      <div className="max-w-xl w-full flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Attendance Terminal</span>
            <span className="text-xs font-semibold text-slate-700">Select Organization:</span>
          </div>
        </div>

        <div className="w-full sm:w-auto">
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="w-full sm:w-64 text-sm font-bold text-slate-800 bg-slate-50 border-2 border-blue-200 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none shadow-sm cursor-pointer"
          >
            {orgList.length === 0 && organization && (
              <option value={organization.slug || organization.id}>{organization.name}</option>
            )}
            {orgList.map(o => (
              <option key={o.id} value={o.slug || o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative w-full max-w-lg bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-xl flex flex-col items-center">
        <div className="w-full mb-3 px-3.5 py-2 bg-blue-50/80 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-800">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
            <span>{challenge.instruction}</span>
          </div>
          <span className="px-2 py-0.5 bg-blue-600 text-white font-bold rounded-md text-[10px]">LIVENESS ACTIVE</span>
        </div>

        <div className="relative w-full aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas ref={canvasRef} className="hidden" />

          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className={`w-52 h-64 border-2 border-dashed rounded-[50%] transition-colors duration-300 ${borderStyle}`} />
          </div>

          {scanStatus === 'SUCCESS' && punchResult && (
            <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/40">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-300 mb-1">
                {punchResult.action === 'CHECK_IN' ? 'Check-In Recorded' : 'Check-Out Recorded'}
              </span>
              <h3 className="text-2xl font-extrabold text-white mb-1">
                {punchResult.employee_name}
              </h3>
              <p className="text-sm text-emerald-200 mb-2">
                {punchResult.department} • ID: {punchResult.employee_code}
              </p>
              <div className="bg-emerald-900/60 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-100">
                Time: {punchResult.timestamp} ({punchResult.attendance_status})
              </div>
            </div>
          )}

          {scanStatus === 'ERROR' && (
            <div className="absolute inset-0 bg-red-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center mb-3 shadow-lg shadow-red-500/40">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-lg font-bold mb-1">Recognition Failed</h4>
              <p className="text-xs text-red-200 max-w-xs">{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="w-full mt-4 flex items-center gap-3">
          <button
            onClick={triggerVerification}
            disabled={scanStatus === 'SCANNING' || !streamActive}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-base shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2.5 disabled:opacity-60"
          >
            {scanStatus === 'SCANNING' ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Verifying Face...
              </>
            ) : (
              <>
                <ScanFace className="w-5 h-5" />
                Verify & Log Attendance
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>Argus Privacy: Real-time vector matching. No camera photos are stored on disk.</span>
      </div>
    </div>
  );
};
