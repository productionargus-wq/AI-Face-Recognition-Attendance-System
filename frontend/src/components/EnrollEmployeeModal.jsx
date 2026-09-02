import React, { useState, useRef, useEffect } from 'react';
import api from '../utils/api';
import { X, Camera, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';

export const EnrollEmployeeModal = ({ isOpen, onClose, onEmployeeCreated }) => {
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    employee_code: '',
    first_name: '',
    last_name: '',
    email: '',
    department: 'Engineering',
    designation: '',
    phone: ''
  });

  const [consentAgreed, setConsentAgreed] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [createdEmployee, setCreatedEmployee] = useState(null);
  const [samples, setSamples] = useState([]);
  const [capturing, setCapturing] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360, facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera error', err);
      setError('Could not access webcam. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
  };

  useEffect(() => {
    if (step === 3 && isOpen) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [step, isOpen]);

  if (!isOpen) return null;

  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post('/employees/', formData);
      setCreatedEmployee(res.data);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create employee profile.');
    }
  };

  const handleConsentSubmit = () => {
    if (!consentAgreed) {
      setError('Explicit biometric consent is required to proceed with facial enrollment.');
      return;
    }
    setError('');
    setStep(3);
  };

  const captureSingleFrame = () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const autoCapture3Samples = async () => {
    setCapturing(true);
    setError('');
    const captured = [];

    for (let i = 1; i <= 3; i++) {
      await new Promise(r => setTimeout(r, 600));
      const frame = captureSingleFrame();
      if (frame) {
        captured.push(frame);
        setSamples([...captured]);
      }
    }
    setCapturing(false);
  };

  const submitFaceEnrollment = async () => {
    if (samples.length < 1) {
      setError('Please capture at least 1-3 face sample frames.');
      return;
    }
    setEnrolling(true);
    setError('');
    try {
      await api.post('/employees/' + createdEmployee.id + '/enroll-face', {
        samples: samples,
        consent_given: true
      });
      setSuccessMsg('Biometric facial vectors saved securely!');
      setTimeout(() => {
        onEmployeeCreated();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Facial vectorization failed. Ensure face is clear.');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>1</span>
            <div className={`h-1 flex-1 rounded ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>2</span>
            <div className={`h-1 flex-1 rounded ${step >= 3 ? 'bg-blue-600' : 'bg-slate-200'}`} />
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>3</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {step === 1 && 'Step 1: Employee Information'}
            {step === 2 && 'Step 2: Biometric Consent'}
            {step === 3 && 'Step 3: Face Vector Capture (3 Samples)'}
          </h3>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleInfoSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Code / ID</label>
                <input
                  type="text"
                  required
                  placeholder="ARG-104"
                  value={formData.employee_code}
                  onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  required
                  placeholder="Engineering"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  placeholder="Sarah"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  placeholder="Jenkins"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="sarah.j@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  required
                  placeholder="Product Designer"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone (Optional)</label>
                <input
                  type="text"
                  placeholder="+1 555-0122"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors"
            >
              Continue to Biometric Consent
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-1">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Biometric Data Processing Agreement
              </div>
              <p>
                In compliance with data protection laws, Argus AI Attendance captures mathematical vector representations (128-dimensional float embeddings) derived from facial features solely for time and attendance tracking.
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li><strong>No raw photos</strong> are stored on disk or server databases.</li>
                <li>Vectors cannot be reverse-engineered into photographic images.</li>
                <li>Data is securely isolated to your organization tenant.</li>
              </ul>
            </div>

            <label className="flex items-start gap-3 p-3 bg-blue-50/60 border border-blue-200 rounded-xl cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentAgreed}
                onChange={(e) => setConsentAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-slate-800">
                I acknowledge and grant explicit consent on behalf of {formData.first_name} {formData.last_name} for biometric vector enrollment.
              </span>
            </label>

            <button
              type="button"
              onClick={handleConsentSubmit}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors"
            >
              Proceed to Camera Capture
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="relative aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
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
                <div className="w-36 h-48 border-2 border-dashed border-white/70 rounded-[50%]" />
              </div>

              <div className="absolute bottom-2 left-2 bg-slate-900/80 px-2.5 py-1 rounded-lg text-[11px] text-white font-medium">
                Samples: {samples.length} / 3 captured
              </div>
            </div>

            {samples.length > 0 && (
              <div className="flex items-center gap-2 justify-center">
                {samples.map((s, idx) => (
                  <img
                    key={idx}
                    src={s}
                    alt="sample"
                    className="w-12 h-12 object-cover rounded-lg border-2 border-blue-500 shadow-sm"
                  />
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={autoCapture3Samples}
                disabled={capturing || enrolling}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Camera className="w-4 h-4 text-blue-600" />
                {capturing ? 'Capturing 3 Samples...' : 'Auto-Capture 3 Samples'}
              </button>

              <button
                type="button"
                onClick={submitFaceEnrollment}
                disabled={samples.length < 1 || enrolling}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {enrolling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Vectorizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Save Face Vector
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
