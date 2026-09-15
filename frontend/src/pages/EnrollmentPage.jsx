import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { 
  Fingerprint, 
  ShieldCheck, 
  Lock, 
  Check, 
  Camera, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ChevronDown,
  Sparkles,
  Terminal,
  RefreshCw,
  Plus,
  UserPlus
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { EnrollEmployeeModal } from '../components/EnrollEmployeeModal';

export const EnrollmentPage = () => {
  const { organization } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Form State - Clean blank start for new organizations
  const [formData, setFormData] = useState({
    fullName: '',
    employeeId: '',
    department: '',
    email: '',
    assignedSchedule: '08:30 AM - 05:00 PM'
  });

  // Camera & Vector Snapshot State
  const [streamActive, setStreamActive] = useState(false);
  const [capturedFrame, setCapturedFrame] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Recent Terminal Verification Audit table data (empty by default)
  const [auditList, setAuditList] = useState([]);

  useEffect(() => {
    startCamera();
    fetchRecentEmployees();
    return () => {
      stopCamera();
    };
  }, []);

  const fetchRecentEmployees = async () => {
    try {
      const res = await api.get('/employees/');
      if (res.data && res.data.length > 0) {
        const mapped = res.data.slice(0, 5).map((e, idx) => ({
          id: e.id || 'aud-' + idx,
          registeredTime: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          employeeName: `${e.first_name} ${e.last_name}`.trim(),
          employeeId: e.employee_code,
          department: e.department || 'Engineering',
          status: e.has_biometric ? 'ENROLLED' : 'RE-CALIBRATE'
        }));
        setAuditList(mapped);
      } else {
        setAuditList([]);
      }
    } catch (err) {
      setAuditList([]);
    }
  };

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
      console.error('Camera error', err);
      setErrorMessage('Could not initialize optical camera. Check permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const handleSnapFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedFrame(dataUrl);
    setStatusMessage('Frame captured. Biometric vectors ready for validation.');
    setErrorMessage('');
  };

  const handleRetakeFrame = () => {
    setCapturedFrame(null);
    setStatusMessage('');
    setErrorMessage('');
  };

  const handleSaveEnrollment = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');

    if (!capturedFrame) {
      // Auto snap if not already snapped
      handleSnapFrame();
    }

    setIsProcessing(true);

    try {
      // Split full name into first and last name
      const nameParts = formData.fullName.trim().split(' ');
      const firstName = nameParts[0] || 'Employee';
      const lastName = nameParts.slice(1).join(' ') || 'Staff';

      // 1. Create Employee Profile
      const empRes = await api.post('/employees/', {
        employee_code: formData.employeeId,
        first_name: firstName,
        last_name: lastName,
        email: formData.email,
        department: formData.department,
        designation: formData.department,
        phone: '1234567890'
      });

      const newEmp = empRes.data;

      // 2. Enroll Biometric Vectors
      const snapToEnroll = capturedFrame || (canvasRef.current && canvasRef.current.toDataURL('image/jpeg', 0.9));
      if (snapToEnroll) {
        await api.post(`/employees/${newEmp.id}/enroll-face`, {
          samples: [snapToEnroll],
          consent_given: true
        });
      }

      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 }
      });

      setStatusMessage('Biometric enrollment successfully finalized & encrypted!');

      // Prepend to audit list
      setAuditList(prev => [
        {
          id: 'aud-' + Date.now(),
          registeredTime: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          employeeName: formData.fullName,
          employeeId: formData.employeeId,
          department: formData.department,
          status: 'ENROLLED'
        },
        ...prev.slice(0, 4)
      ]);

      // Reset form with next ID
      setTimeout(() => {
        const randNum = Math.floor(1000 + Math.random() * 9000);
        setFormData({
          fullName: '',
          employeeId: `ARG-${randNum}-SEC`,
          department: 'Systems Architecture',
          email: '',
          assignedSchedule: '08:30 AM - 05:00 PM'
        });
        setCapturedFrame(null);
        setStatusMessage('');
      }, 2500);

    } catch (err) {
      setErrorMessage(err.response?.data?.detail || 'Failed to complete biometric enrollment.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 shadow-xs">
            <Fingerprint className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold font-mono tracking-wider text-slate-900 uppercase">
              BIOMETRIC ENROLLMENT
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Register personnel credentials and vectorize 128-dimensional facial embeddings.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052cc] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      {/* 2. Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Personnel Record Form (approx 5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <form onSubmit={handleSaveEnrollment} className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold font-mono text-slate-700 tracking-wider uppercase">
                PERSONNEL RECORD
              </span>
              <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-700 font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>RECORD_NEW</span>
              </div>
            </div>

            {/* Field: Full Name */}
            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                [FULL_NAME]
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Dr. Aris Thorne"
                  required
                  className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2.5 pr-8 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center pointer-events-none">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </div>
              </div>
            </div>

            {/* Field Row: Employee ID & Department */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  [EMPLOYEE_ID]
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    required
                    className="w-full text-xs font-mono font-bold text-blue-600 bg-blue-50/40 border border-slate-200 rounded-lg px-3 py-2.5 pr-8 focus:outline-none focus:border-blue-500"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  [DEPARTMENT]
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g. Systems Architecture"
                  required
                  className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Field: E-Mail */}
            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                [E-MAIL]
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="e.g. a.thorne@argus-sec.internal"
                required
                className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Field: Assigned Schedule */}
            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                [ASSIGNED_SCHEDULE]
              </label>
              <div className="relative">
                <select
                  value={formData.assignedSchedule}
                  onChange={(e) => setFormData({ ...formData, assignedSchedule: e.target.value })}
                  className="w-full text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2.5 pr-8 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="08:30 AM - 05:00 PM">08:30 AM - 05:00 PM</option>
                  <option value="09:00 AM - 06:00 PM">09:00 AM - 06:00 PM</option>
                  <option value="08:00 AM - 04:30 PM">08:00 AM - 04:30 PM</option>
                  <option value="10:00 AM - 07:00 PM">10:00 AM - 07:00 PM</option>
                  <option value="Night Shift (08:00 PM - 05:00 AM)">Night Shift (08:00 PM - 05:00 AM)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Feedback Messages */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {statusMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}
          </form>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 font-mono">
            ENCRYPTION: AES-256-GCM / 128-D EMBEDDINGS
          </div>
        </div>

        {/* Right Column: Live Camera Biometric HUD & Actions (approx 7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between gap-4">
          {/* Top Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                OPTICAL BIOMETRIC ACQUISITION SENSOR
              </span>
            </div>
            <span className="text-[10px] font-mono text-cyan-600 font-bold">
              CAMERA_STATE: {streamActive ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          {/* Camera Viewport with Cybernetic Reticle */}
          <div className="relative w-full aspect-[16/10] bg-slate-950 rounded-lg overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
            {/* Corner Cybernetic Brackets */}
            <div className="hud-corner-tl !border-cyan-400 !w-5 !h-5 !top-3 !left-3 z-10 pointer-events-none" />
            <div className="hud-corner-tr !border-cyan-400 !w-5 !h-5 !top-3 !right-3 z-10 pointer-events-none" />
            <div className="hud-corner-bl !border-cyan-400 !w-5 !h-5 !bottom-3 !left-3 z-10 pointer-events-none" />
            <div className="hud-corner-br !border-cyan-400 !w-5 !h-5 !bottom-3 !right-3 z-10 pointer-events-none" />

            {/* Video or Preview */}
            {capturedFrame ? (
              <img
                src={capturedFrame}
                alt="Captured Face Frame"
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            )}
            <canvas ref={canvasRef} className="hidden" />

            {/* Face Targeting Mesh & Brackets Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-44 sm:w-56 h-52 sm:h-64 border border-cyan-400/30 rounded-2xl flex items-center justify-center">
                {/* HUD Corner markers */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />

                {/* Subtle blueprint grid glow */}
                <div className="w-12 h-12 border border-cyan-400/20 rounded-full flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                </div>
              </div>
            </div>

            {/* Bottom In-Camera Control Toolbar */}
            <div className="absolute bottom-3 inset-x-3 z-20 bg-slate-900/80 backdrop-blur-md rounded-lg p-2 flex items-center justify-between border border-slate-700/60">
              <div className="flex items-center gap-2 pl-2 text-slate-400">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-mono uppercase text-slate-300">
                  {capturedFrame ? 'FRAME LOCKED' : 'LIVE ACQUISITION'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRetakeFrame}
                  className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono font-bold tracking-wider uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span>RETAKE FRAME</span>
                </button>

                <button
                  type="button"
                  onClick={handleSnapFrame}
                  className="px-3.5 py-1.5 rounded-md bg-[#0080ff] hover:bg-blue-600 active:scale-95 text-white text-[11px] font-mono font-bold tracking-wider uppercase transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3 h-3 text-white" />
                  <span>SNAP</span>
                </button>
              </div>
            </div>
          </div>

          {/* Action Row Below Camera */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
              <Fingerprint className="w-4 h-4 text-emerald-600" />
              <span>READY FOR PROFILE VALIDATION</span>
            </div>

            <button
              type="button"
              onClick={handleSaveEnrollment}
              disabled={isProcessing}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#007348] hover:bg-[#005f3b] active:scale-[0.99] text-white font-bold font-mono text-xs uppercase tracking-wider transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>SAVING ENROLLMENT...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>SAVE & COMPLETE ENROLLMENT</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Bottom Table Card: Recent Terminal Verification Audit */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
          <Clock className="w-4 h-4 text-blue-600" />
          <h3 className="text-xs font-bold font-mono tracking-wider text-slate-800 uppercase">
            RECENT TERMINAL VERIFICATION AUDIT
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase font-mono tracking-wider bg-slate-50/50">
                <th className="py-2.5 px-3">REGISTERED TIME</th>
                <th className="py-2.5 px-3">EMPLOYEE NAME</th>
                <th className="py-2.5 px-3">EMPLOYEE ID</th>
                <th className="py-2.5 px-3">DEPARTMENT</th>
                <th className="py-2.5 px-3 text-right">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Fingerprint className="w-7 h-7 text-slate-300 stroke-1" />
                      <p className="text-xs font-bold text-slate-600">
                        No personnel enrolled yet.
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        Fill in the personnel record above and capture an optical frame to enroll your first employee.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : auditList.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-600 font-medium">
                    {row.registeredTime}
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {row.employeeName}
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-blue-600">
                    {row.employeeId}
                  </td>
                  <td className="py-3 px-3 text-slate-600">
                    {row.department}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                        row.status === 'ENROLLED'
                          ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Replicated Add Employee Modal from Admin Dashboard */}
      <EnrollEmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEmployeeCreated={() => {
          fetchRecentEmployees();
          setIsModalOpen(false);
        }}
      />
    </div>
  );
};
