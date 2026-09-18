import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, 
  ShieldCheck, 
  ShieldAlert, 
  Navigation, 
  RotateCcw, 
  Save, 
  Building2, 
  Clock, 
  Filter, 
  Search, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  Sliders, 
  ExternalLink,
  ChevronRight,
  RefreshCw,
  LocateFixed,
  Radio
} from 'lucide-react';

export const LiveMapGeofence = () => {
  const { organization } = useAuth();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const officeCircleRef = useRef(null);
  const officeMarkerRef = useRef(null);
  const punchMarkersLayerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({
    date: '',
    geofence: {
      is_enabled: true,
      latitude: 13.0827,
      longitude: 80.2707,
      radius_meters: 200,
      strict_enforcement: false,
      office_name: 'Headquarters'
    },
    punches: [],
    total_punches: 0,
    inside_count: 0,
    violation_count: 0
  });

  // Config Drawer & Form State
  const [showEditor, setShowEditor] = useState(false);
  const [savingGeofence, setSavingGeofence] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editorForm, setEditorForm] = useState({
    is_enabled: true,
    latitude: 13.0827,
    longitude: 80.2707,
    radius_meters: 200,
    strict_enforcement: false,
    office_name: 'Headquarters'
  });

  // Filters
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'INSIDE' | 'OUTSIDE'
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPunch, setSelectedPunch] = useState(null);

  // Fetch live punches and geofence config
  const fetchMapData = async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await api.get('/attendance/map-punches');
      setData(res.data);
      if (res.data?.geofence) {
        setEditorForm(res.data.geofence);
      }
    } catch (err) {
      console.error('Failed to load live map data', err);
    } finally {
      if (!isSilent) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(() => {
      fetchMapData(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = editorForm.latitude || 13.0827;
    const initialLon = editorForm.longitude || 80.2707;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 16,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // OpenStreetMap Clean Carto-style tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // Layer group for dynamic punch markers
    const punchLayer = L.layerGroup().addTo(map);
    punchMarkersLayerRef.current = punchLayer;

    mapInstanceRef.current = map;

    // Handle map clicks when editor is open
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      setEditorForm(prev => ({
        ...prev,
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lng.toFixed(6))
      }));
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Geofence Circle and Office HQ Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const lat = editorForm.latitude || 13.0827;
    const lon = editorForm.longitude || 80.2707;
    const radius = editorForm.radius_meters || 200;

    // Remove old circle
    if (officeCircleRef.current) {
      map.removeLayer(officeCircleRef.current);
    }

    // Draw new Geofence Circle
    const circle = L.circle([lat, lon], {
      radius: radius,
      color: '#2563eb',
      weight: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.12,
      dashArray: '6, 6'
    }).addTo(map);
    officeCircleRef.current = circle;

    // Remove old marker
    if (officeMarkerRef.current) {
      map.removeLayer(officeMarkerRef.current);
    }

    // Office HQ Marker
    const hqIcon = L.divIcon({
      className: 'custom-hq-marker',
      html: `
        <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2">
          <span class="absolute animate-ping inline-flex h-9 w-9 rounded-full bg-blue-400 opacity-60"></span>
          <div class="w-8 h-8 rounded-xl bg-blue-600 border-2 border-white shadow-md flex items-center justify-center text-white text-[11px] font-black">
            HQ
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([lat, lon], { 
      icon: hqIcon,
      draggable: true
    }).addTo(map);

    marker.bindPopup(`
      <div class="p-2 text-xs font-sans min-w-[180px]">
        <div class="flex items-center gap-1.5 font-black text-blue-600 uppercase text-[11px] mb-1">
          <span class="w-2 h-2 rounded-full bg-blue-600"></span>
          <span>${editorForm.office_name || 'Designated Office'}</span>
        </div>
        <div class="text-slate-600 font-semibold mb-1">Active Geofence Center</div>
        <div class="text-[10px] font-mono text-slate-400">Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}</div>
        <div class="text-[10px] font-mono text-blue-700 font-bold mt-1">Perimeter: ${radius} meters radius</div>
      </div>
    `);

    marker.on('dragend', (e) => {
      const newPos = e.target.getLatLng();
      setEditorForm(prev => ({
        ...prev,
        latitude: parseFloat(newPos.lat.toFixed(6)),
        longitude: parseFloat(newPos.lng.toFixed(6))
      }));
    });

    officeMarkerRef.current = marker;
  }, [editorForm.latitude, editorForm.longitude, editorForm.radius_meters, editorForm.office_name]);

  // Filtered Punches List
  const filteredPunches = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (data.punches || []).filter(p => {
      const matchesFilter = 
        filterMode === 'ALL' || 
        (filterMode === 'INSIDE' && p.geofence_status === 'INSIDE') ||
        (filterMode === 'OUTSIDE' && p.geofence_status === 'OUTSIDE');

      const matchesDept = selectedDept === 'All Departments' || p.department.toLowerCase() === selectedDept.toLowerCase();

      const matchesQuery = !q ||
        p.employee_name.toLowerCase().includes(q) ||
        p.employee_code.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q);

      return matchesFilter && matchesDept && matchesQuery;
    });
  }, [data.punches, filterMode, selectedDept, searchQuery]);

  // Distinct Departments
  const departmentsList = useMemo(() => {
    const set = new Set();
    (data.punches || []).forEach(p => {
      if (p.department) set.add(p.department.trim());
    });
    return ['All Departments', ...Array.from(set)];
  }, [data.punches]);

  // Render Punch Markers on Map
  useEffect(() => {
    const layer = punchMarkersLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    filteredPunches.forEach(p => {
      if (!p.latitude || !p.longitude) return;

      const isInside = p.geofence_status === 'INSIDE';
      const markerColor = isInside ? '#059669' : '#dc2626';

      const punchIcon = L.divIcon({
        className: 'custom-punch-marker',
        html: `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <span class="absolute inline-flex h-6 w-6 rounded-full opacity-40 ${isInside ? 'bg-emerald-400' : 'bg-red-400 animate-ping'}"></span>
            <div class="w-7 h-7 rounded-full ${isInside ? 'bg-emerald-600' : 'bg-red-600'} border-2 border-white shadow-md flex items-center justify-center text-white text-[9px] font-black transition-transform hover:scale-125">
              ${p.avatar || 'EM'}
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([p.latitude, p.longitude], { icon: punchIcon });

      const distText = p.distance_meters !== null && p.distance_meters !== undefined 
        ? `${Math.round(p.distance_meters)}m from HQ` 
        : 'Distance N/A';

      const popupHtml = `
        <div class="p-2.5 text-xs font-sans min-w-[210px] space-y-1.5">
          <div class="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <div>
              <div class="font-black text-slate-900 text-xs">${p.employee_name}</div>
              <div class="text-[10px] font-mono text-slate-400">${p.employee_code} • ${p.department}</div>
            </div>
            <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
              isInside ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            }">
              ${isInside ? 'VERIFIED ON-SITE' : 'GEOFENCE VIOLATION'}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-1 text-[10px] pt-0.5">
            <div>
              <span class="text-slate-400 uppercase font-mono text-[9px]">Punch-In</span>
              <div class="font-bold text-slate-800 font-mono">${p.check_in_time || '—'}</div>
            </div>
            <div>
              <span class="text-slate-400 uppercase font-mono text-[9px]">Distance</span>
              <div class="font-bold ${isInside ? 'text-emerald-700' : 'text-red-600'} font-mono">${distText}</div>
            </div>
          </div>

          <div class="text-[9px] font-mono text-slate-400 pt-1 border-t border-slate-100">
            GPS: ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      layer.addLayer(marker);
    });
  }, [filteredPunches]);

  // Center on employee pin
  const handleSelectPunch = (p) => {
    setSelectedPunch(p);
    const map = mapInstanceRef.current;
    if (map && p.latitude && p.longitude) {
      map.flyTo([p.latitude, p.longitude], 18, { duration: 1.2 });
    }
  };

  // Use Current Device Location for HQ
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setEditorForm(prev => ({
          ...prev,
          latitude: parseFloat(latitude.toFixed(6)),
          longitude: parseFloat(longitude.toFixed(6))
        }));
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 17);
        }
      },
      (err) => {
        alert('Could not retrieve current location. Please ensure location permissions are granted.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Save Geofence Configuration
  const handleSaveGeofence = async (e) => {
    e.preventDefault();
    setSavingGeofence(true);
    setSaveSuccess(false);
    try {
      await api.put('/organizations/my-org/geofence', editorForm);
      setSaveSuccess(true);
      await fetchMapData(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      alert('Failed to save geofence settings.');
    } finally {
      setSavingGeofence(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] space-y-3">
      {/* Top Header & Metrics Banner */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
                REAL-TIME GEOFENCE MAPVIEW
              </h1>
              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-mono font-bold">
                LIVE GPS
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Live perimeter tracking &amp; employee check-in verification for {organization?.name || 'Organisation'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Metrics */}
          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold">
            <div>
              <span className="text-slate-400 text-[10px] font-mono uppercase block">Total Punches</span>
              <span className="font-bold text-slate-800">{data.total_punches}</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 text-[10px] font-mono uppercase block">On-Site</span>
              <span className="font-bold text-emerald-600">{data.inside_count}</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 text-[10px] font-mono uppercase block">Violations</span>
              <span className="font-bold text-red-600">{data.violation_count}</span>
            </div>
          </div>

          <button
            onClick={() => setShowEditor(!showEditor)}
            className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
              showEditor 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showEditor ? 'Hide Perimeter Setup' : 'Configure Geofence'}</span>
          </button>

          <button
            onClick={() => fetchMapData()}
            disabled={refreshing}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 transition-colors cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Work Area: Map + Side Feed */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 overflow-hidden">
        {/* Left / Center: Interactive Leaflet Map Container */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden relative flex flex-col">
          {/* Map Controls Floating Overlay */}
          <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2 bg-white/90 backdrop-blur-xs p-1.5 rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                filterMode === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All ({data.total_punches})
            </button>
            <button
              onClick={() => setFilterMode('INSIDE')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                filterMode === 'INSIDE' ? 'bg-emerald-600 text-white' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>On-Site ({data.inside_count})</span>
            </button>
            <button
              onClick={() => setFilterMode('OUTSIDE')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                filterMode === 'OUTSIDE' ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Violations ({data.violation_count})</span>
            </button>
          </div>

          {/* Map DOM Target */}
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Bottom Floating Legend */}
          <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-[11px] font-semibold flex items-center gap-3 text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
              <span>Office HQ ({editorForm.radius_meters}m Perimeter)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
              <span>Verified On-Site</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span>
              <span>Geofence Violation</span>
            </div>
          </div>
        </div>

        {/* Right Panel: Geofence Setup Drawer OR Live Feed */}
        <div className="w-full lg:w-96 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden shrink-0">
          {showEditor ? (
            /* Setup Drawer Form */
            <form onSubmit={handleSaveGeofence} className="flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold uppercase text-slate-800">
                    Geofence Perimeter Setup
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  Close
                </button>
              </div>

              <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs">
                {saveSuccess && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Geofence perimeter saved!</span>
                  </div>
                )}

                {/* Enable Geofencing Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-800">Enable Geofencing</div>
                    <div className="text-[10px] text-slate-400">Validate physical location for punches</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={editorForm.is_enabled}
                    onChange={(e) => setEditorForm({ ...editorForm, is_enabled: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {/* Office Name */}
                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase mb-1">
                    Premises / Branch Name
                  </label>
                  <input
                    type="text"
                    value={editorForm.office_name}
                    onChange={(e) => setEditorForm({ ...editorForm, office_name: e.target.value })}
                    className="w-full text-xs font-semibold text-slate-800 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Chennai Headquarters"
                  />
                </div>

                {/* Coordinates Picker */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase mb-1">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editorForm.latitude}
                      onChange={(e) => setEditorForm({ ...editorForm, latitude: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs font-mono font-semibold text-slate-800 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase mb-1">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editorForm.longitude}
                      onChange={(e) => setEditorForm({ ...editorForm, longitude: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs font-mono font-semibold text-slate-800 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Helper Button: GPS Auto-fill */}
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-xs"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  <span>Set to My Current Device GPS</span>
                </button>

                <p className="text-[10px] text-slate-400 italic">
                  💡 Tip: You can also drag the blue "HQ" marker directly on the map or click anywhere on the map to place the perimeter center.
                </p>

                {/* Radius Slider */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                      Perimeter Radius
                    </label>
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-bold text-xs">
                      {editorForm.radius_meters} meters
                    </span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="25"
                    value={editorForm.radius_meters}
                    onChange={(e) => setEditorForm({ ...editorForm, radius_meters: parseInt(e.target.value, 10) })}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>50m (Tight)</span>
                    <span>500m</span>
                    <span>1,000m (Large)</span>
                  </div>
                </div>

                {/* Strict Enforcement Toggle */}
                <div className="flex items-start justify-between p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                  <div className="pr-2">
                    <div className="font-bold text-amber-900">Strict Enforcement</div>
                    <div className="text-[10px] text-amber-700">
                      Block check-in if employee is outside the perimeter. If unchecked, punches are logged but flagged as violations.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={editorForm.strict_enforcement}
                    onChange={(e) => setEditorForm({ ...editorForm, strict_enforcement: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer mt-0.5 shrink-0"
                  />
                </div>
              </div>

              {/* Save Footer */}
              <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="submit"
                  disabled={savingGeofence}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingGeofence ? 'Saving...' : 'Save Geofence Settings'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Live Punch Feed Panel */
            <div className="flex flex-col h-full overflow-hidden">
              {/* Feed Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold uppercase text-slate-800">
                      Live Check-In Pins ({filteredPunches.length})
                    </h3>
                  </div>
                </div>

                {/* Mini Search & Dept Dropdown */}
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, code, dept..."
                      className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    {departmentsList.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Punch Item List */}
              <div className="overflow-y-auto flex-1 p-2 space-y-1.5 divide-y divide-slate-100">
                {filteredPunches.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-1.5">
                    <MapPin className="w-8 h-8 text-slate-300 stroke-1" />
                    <span className="font-bold text-slate-600">No punches found</span>
                    <span className="text-[10px]">Punches captured with GPS will appear on the map here.</span>
                  </div>
                ) : (
                  filteredPunches.map(p => {
                    const isInside = p.geofence_status === 'INSIDE';
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectPunch(p)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                          selectedPunch?.id === p.id 
                            ? 'bg-blue-50/80 border-blue-300 shadow-xs' 
                            : 'bg-white hover:bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg text-white font-bold text-xs flex items-center justify-center shrink-0 ${
                            isInside ? 'bg-emerald-600' : 'bg-red-600'
                          }`}>
                            {p.avatar || 'EM'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 text-xs truncate">
                              {p.employee_name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {p.employee_code} • {p.department}
                            </div>
                            <div className="text-[10px] font-mono text-blue-600 font-semibold mt-0.5">
                              {p.check_in_time || '—'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold block mb-1 ${
                            isInside ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {isInside ? 'ON-SITE' : 'VIOLATION'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 block">
                            {p.distance_meters !== null && p.distance_meters !== undefined ? `${Math.round(p.distance_meters)}m` : '—'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
