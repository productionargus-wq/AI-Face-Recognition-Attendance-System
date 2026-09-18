import React, { useState, useRef, useEffect } from 'react';
import api from '../utils/api';
import { X, Camera, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';

export const ALL_PERMISSIONS = [
  { id: '/admin', label: 'Employee Dashboard', desc: 'Self-service attendance & logs' },
  { id: '/kiosk', label: 'Attendance Capture', desc: 'Kiosk facial recognition' },
  { id: '/enrollment', label: 'Biometric Enrollment', desc: 'Face registration & roster' },
  { id: '/manual-entry', label: 'Manual Entry', desc: 'Duty shifts & override logs' },
  { id: '/advance-money', label: 'Advance Money', desc: 'Salary advance & repayment' },
  { id: '/leave-apply', label: 'Leave Apply', desc: 'Leave applications & tracking' },
  { id: '/payroll', label: 'My Salary & Payslip', desc: 'Personal compensation, breakdown & payout history' },
  { id: '/geofence', label: 'Live Map & Geofence', desc: 'Realtime map & geofence perimeter tracking' },
  { id: '/settings', label: 'Settings', desc: 'Organization configurations' }
];

export const DEFAULT_PERMISSIONS = ['/admin', '/kiosk', '/leave-apply', '/advance-money', '/payroll', '/geofence'];

export const EnrollEmployeeModal = ({ isOpen, onClose, onEmployeeCreated }) => {
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    employee_code: '',
    first_name: '',
    last_name: '',
    email: '',
    department: 'Engineering',
    designation: '',
    phone: '',
    employment_type: 'FULL_TIME',
    shift_type: 'FIXED',
    target_daily_hours: 8.5,
    daily_wage_rate: 600,
    assigned_shift: 'General Shift (09:00 AM – 05:30 PM • 8.5h)',
    shift_start: '09:00',
    shift_end: '17:30',
    base_salary: 40000,
    hourly_rate: 250,
    statutory_deductions: 3000,
    permissions: DEFAULT_PERMISSIONS
  });

  const handleEmploymentTypeChange = (type) => {
    if (type === 'PART_TIME') {
      setFormData(prev => ({
        ...prev,
        employment_type: type,
        shift_type: 'FIXED',
        target_daily_hours: 4.0,
        base_salary: 20000,
        assigned_shift: 'Part-Time Shift (10:00 AM – 02:00 PM • 4.0h)',
        shift_start: '10:00',
        shift_end: '14:00'
      }));
    } else if (type === 'DAILY_WAGE') {
      setFormData(prev => ({
        ...prev,
        employment_type: type,
        shift_type: 'FLEXIBLE',
        target_daily_hours: 8.0,
        daily_wage_rate: 650,
        hourly_rate: 80,
        base_salary: 0,
        assigned_shift: 'Flexible Daily Wage Schedule (No Fixed Hours)',
        shift_start: '09:00',
        shift_end: '18:00'
      }));
    } else if (type === 'FIELD_WORKER') {
      setFormData(prev => ({
        ...prev,
        employment_type: type,
        shift_type: 'FLEXIBLE',
        target_daily_hours: 8.0,
        base_salary: 35000,
        hourly_rate: 220,
        assigned_shift: 'Field Worker Schedule (Multi-Site External Visits)',
        shift_start: '09:00',
        shift_end: '18:00'
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        employment_type: type,
        shift_type: 'FIXED',
        target_daily_hours: 8.5,
        base_salary: 40000,
        assigned_shift: 'General Shift (09:00 AM – 05:30 PM • 8.5h)',
        shift_start: '09:00',
        shift_end: '17:30'
      }));
    }
  };

  const formatTime12h = (time24) => {
    if (!time24) return '';
    try {
      const [h, m] = time24.split(':').map(Number);
      const suffix = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
    } catch {
      return time24;
    }
  };

  const calculateHours = (inTime, outTime) => {
    if (!inTime || !outTime) return 8.5;
    try {
      const [h1, m1] = inTime.split(':').map(Number);
      const [h2, m2] = outTime.split(':').map(Number);
      let diffMins = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diffMins < 0) diffMins += 24 * 60;
      return Math.round((diffMins / 60) * 10) / 10;
    } catch {
      return 8.5;
    }
  };

  const handleCustomTimingChange = (newStart, newEnd) => {
    const start = newStart !== undefined ? newStart : formData.shift_start;
    const end = newEnd !== undefined ? newEnd : formData.shift_end;
    const hrs = calculateHours(start, end);
    const shiftDesc = `Custom Shift (${formatTime12h(start)} – ${formatTime12h(end)} • ${hrs}h)`;
    setFormData(prev => ({
      ...prev,
      shift_start: start,
      shift_end: end,
      assigned_shift: shiftDesc
    }));
  };

  const handleShiftChange = (shiftName) => {
    let start = '09:00';
    let end = '17:30';
    if (shiftName.includes('Morning')) {
      start = '06:00';
      end = '14:30';
    } else if (shiftName.includes('Evening')) {
      start = '14:00';
      end = '22:30';
    } else if (shiftName.includes('Night')) {
      start = '21:00';
      end = '05:30';
    } else if (shiftName.includes('10:00 AM')) {
      start = '10:00';
      end = '19:00';
    }
    setFormData(prev => ({
      ...prev,
      assigned_shift: shiftName,
      shift_start: start,
      shift_end: end
    }));
  };

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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 relative my-auto max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4 sm:mb-5 pr-6">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold ${
              step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>1</span>
            <div className={`h-1 flex-1 rounded ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />
            <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold ${
              step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>2</span>
            <div className={`h-1 flex-1 rounded ${step >= 3 ? 'bg-blue-600' : 'bg-slate-200'}`} />
            <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold ${
              step === 3 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
            }`}>3</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            {step === 1 && 'Step 1: Employee Information'}
            {step === 2 && 'Step 2: Biometric Consent'}
            {step === 3 && 'Step 3: Face Vector Capture (3 Samples)'}
          </h3>
        </div>

        {error && (
          <div className="mb-3 sm:mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-3 sm:mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleInfoSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Code / ID</label>
                <input
                  type="text"
                  required
                  placeholder="ARG-104"
                  value={formData.employee_code}
                  onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                <input
                  type="text"
                  required
                  placeholder="Sarah"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
              <input
                type="email"
                required
                placeholder="sarah.j@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  required
                  placeholder="Product Designer"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone (Optional)</label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Employment Type & Worker Model */}
            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800">
                  Employment Type & Worker Model
                </label>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                  {formData.employment_type.replace('_', ' ')}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleEmploymentTypeChange('FULL_TIME')}
                  className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                    formData.employment_type === 'FULL_TIME'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Full-Time
                  <span className="block text-[10px] font-normal opacity-80">8.5h Standard</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleEmploymentTypeChange('PART_TIME')}
                  className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                    formData.employment_type === 'PART_TIME'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Part-Time
                  <span className="block text-[10px] font-normal opacity-80">{formData.target_daily_hours || 4.0}h Target</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleEmploymentTypeChange('DAILY_WAGE')}
                  className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                    formData.employment_type === 'DAILY_WAGE'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Daily Wage
                  <span className="block text-[10px] font-normal opacity-80">Coolie / Flexible</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleEmploymentTypeChange('FIELD_WORKER')}
                  className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                    formData.employment_type === 'FIELD_WORKER'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Field Worker
                  <span className="block text-[10px] font-normal opacity-80">Client Sites / GPS</span>
                </button>
              </div>

              {formData.employment_type === 'PART_TIME' && (
                <div className="p-2.5 bg-white border border-blue-200 rounded-lg flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-[11px] font-bold text-slate-800">Part-Time Daily Target Hours</span>
                    <span className="text-[10px] text-slate-500">Completing this duration counts as 100% full attendance credit (no late/half-day penalties).</span>
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="12"
                      value={formData.target_daily_hours}
                      onChange={(e) => setFormData({ ...formData, target_daily_hours: parseFloat(e.target.value) || 4.0 })}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold text-slate-800 text-right focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {formData.employment_type === 'DAILY_WAGE' && (
                <div className="p-2.5 bg-white border border-amber-200 rounded-lg flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-[11px] font-bold text-amber-900">Flexible Daily Wage Mode Active</span>
                    <span className="text-[10px] text-amber-700">Workers can punch in at random hours without LATE penalties. Pay calculated per logged hours & daily rate.</span>
                  </div>
                  <div className="w-28">
                    <label className="block text-[9px] uppercase font-bold text-slate-500">Wage (₹/day)</label>
                    <input
                      type="number"
                      step="50"
                      min="0"
                      value={formData.daily_wage_rate}
                      onChange={(e) => setFormData({ ...formData, daily_wage_rate: parseFloat(e.target.value) || 600 })}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold text-slate-800 text-right focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {formData.employment_type === 'FIELD_WORKER' && (
                <div className="p-2.5 bg-white border border-purple-200 rounded-lg flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-[11px] font-bold text-purple-900">Field Worker Anti-Fraud Tracking Active</span>
                    <span className="text-[10px] text-purple-700">Punches are verified against authorized client project sites with facial biometrics and GPS perimeter check.</span>
                  </div>
                  <div className="w-28">
                    <label className="block text-[9px] uppercase font-bold text-slate-500">Base Pay (₹)</label>
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      value={formData.base_salary}
                      onChange={(e) => setFormData({ ...formData, base_salary: parseFloat(e.target.value) || 35000 })}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold text-slate-800 text-right focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Assigned Shift / Working Schedule
              </label>
              <select
                value={
                  [
                    'General Shift (09:00 AM – 05:30 PM • 8.5h)',
                    'Morning Shift (06:00 AM – 02:30 PM • 8.5h)',
                    'Evening Shift (02:00 PM – 10:30 PM • 8.5h)',
                    'Night Shift (09:00 PM – 05:30 AM • 8.5h)',
                    'Standard Shift (10:00 AM – 07:00 PM • 9.0h)',
                    'Flexible Schedule (8.0h)'
                  ].includes(formData.assigned_shift) ? formData.assigned_shift : 'CUSTOM'
                }
                onChange={(e) => {
                  if (e.target.value === 'CUSTOM') {
                    handleCustomTimingChange(formData.shift_start, formData.shift_end);
                  } else {
                    handleShiftChange(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer font-medium"
              >
                <option value="General Shift (09:00 AM – 05:30 PM • 8.5h)">General Shift (09:00 AM – 05:30 PM • 8.5h)</option>
                <option value="Morning Shift (06:00 AM – 02:30 PM • 8.5h)">Morning Shift (06:00 AM – 02:30 PM • 8.5h)</option>
                <option value="Evening Shift (02:00 PM – 10:30 PM • 8.5h)">Evening Shift (02:00 PM – 10:30 PM • 8.5h)</option>
                <option value="Night Shift (09:00 PM – 05:30 AM • 8.5h)">Night Shift (09:00 PM – 05:30 AM • 8.5h)</option>
                <option value="Standard Shift (10:00 AM – 07:00 PM • 9.0h)">Standard Shift (10:00 AM – 07:00 PM • 9.0h)</option>
                <option value="Flexible Schedule (8.0h)">Flexible Schedule (8.0h)</option>
                <option value="CUSTOM">Custom Shift (Explicit timings below)</option>
              </select>

              {/* Explicit Shift Timing Pickers */}
              <div className="grid grid-cols-2 gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase mb-1">
                    Shift Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.shift_start}
                    onChange={(e) => handleCustomTimingChange(e.target.value, undefined)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase mb-1">
                    Shift End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.shift_end}
                    onChange={(e) => handleCustomTimingChange(undefined, e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Compensation & Salary Structure */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  Compensation & Salary Structure
                </label>
                <p className="text-[11px] text-slate-500">
                  Assign base compensation, overtime rates, and statutory tax deductions for payroll.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">
                    Base Salary (₹/mo)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={formData.base_salary}
                    onChange={(e) => setFormData({ ...formData, base_salary: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="40000"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">
                    OT Rate (₹/hr)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="25"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="250"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-600 mb-1">
                    PF / Tax Ded. (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.statutory_deductions}
                    onChange={(e) => setFormData({ ...formData, statutory_deductions: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="3000"
                  />
                </div>
              </div>
            </div>

            {/* User Access & Permissions */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-slate-800">
                    User Access & Permissions
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Check the sidebar tabs this employee is permitted to view in their UI.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, permissions: ALL_PERMISSIONS.map(p => p.id) }))}
                    className="text-blue-600 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, permissions: DEFAULT_PERMISSIONS }))}
                    className="text-slate-500 hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {ALL_PERMISSIONS.map((perm) => {
                  const isChecked = (formData.permissions || []).includes(perm.id);
                  return (
                    <label
                      key={perm.id}
                      className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked 
                          ? 'bg-blue-50/60 border-blue-200 text-slate-900' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const current = formData.permissions || [];
                          if (e.target.checked) {
                            setFormData(prev => ({ ...prev, permissions: [...current, perm.id] }));
                          } else {
                            setFormData(prev => ({ ...prev, permissions: current.filter(p => p !== perm.id) }));
                          }
                        }}
                        className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{perm.label}</div>
                        <div className="text-[10px] text-slate-400 truncate">{perm.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer"
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
