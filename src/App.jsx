import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  updateDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  Plus, X, Package, Truck, Calendar as CalendarIcon, 
  ChevronLeft, ChevronRight, Clock, Hash, Trash2, 
  Edit3, Search, ListOrdered, Save, Cloud, 
  Share2, Copy, Check, Bell, BellRing, FilePlus, FileText, Printer, ArrowRight, AlertCircle, AlertTriangle, Eye, ListFilter, ClipboardList
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBF-7P8QhcOQb4KnlxacCDkY3-m1ETvhr0",
  authDomain: "entregas-sii-pallets.firebaseapp.com",
  projectId: "entregas-sii-pallets",
  storageBucket: "entregas-sii-pallets.firebasestorage.app",
  messagingSenderId: "42949067833",
  appId: "1:42949067833:web:37b0257a9e0b8c2a03e103"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'entregas-sii-pallets';

const App = () => {
  const [user, setUser] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loads, setLoads] = useState([]);
  const [internalOCs, setInternalOCs] = useState([]);
  
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // Estados de Modales
  const [showForm, setShowForm] = useState(false);
  const [showOCForm, setShowOCForm] = useState(false);
  const [ocSuccess, setOcSuccess] = useState(null);
  const [viewLoad, setViewLoad] = useState(null); 
  const [shareLoad, setShareLoad] = useState(null);
  const [quickStatusLoad, setQuickStatusLoad] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [notifStatus, setNotifStatus] = useState('default');

  const initialLoadState = {
    date: new Date().toISOString().split('T')[0],
    time: "08:00",
    turnNumber: "",
    customer: "",
    poNumber: "",
    pallets: "",
    transport: "",
    condition: "",
    status: "Pendiente",
    articles: [{ name: "", feature: "" }]
  };
  const [newLoad, setNewLoad] = useState(initialLoadState);

  const [newOC, setNewOC] = useState({
    customer: "",
    date: new Date().toISOString().split('T')[0],
    turn: "", 
    articles: [{ name: "", qty: "" }]
  });

  // REGLA 3: Autenticación
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthInitialized(true);
      if (currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // REGLA 1: Sincronización real
  useEffect(() => {
    if (!user || !authInitialized) return;

    const loadsRef = collection(db, 'artifacts', appId, 'public', 'data', 'loads');
    const ocsRef = collection(db, 'artifacts', appId, 'public', 'data', 'internal_ocs');

    const unsubLoads = onSnapshot(loadsRef, 
      (snap) => setLoads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      (err) => console.error("Error Loads Sync:", err)
    );

    const unsubOCs = onSnapshot(ocsRef, 
      (snap) => setInternalOCs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      (err) => console.error("Error OCs Sync:", err)
    );

    return () => { unsubLoads(); unsubOCs(); };
  }, [user, authInitialized]);

  const internalAlerts = useMemo(() => {
    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fiveDaysLater = new Date(today);
    fiveDaysLater.setDate(today.getDate() + 5);

    loads.forEach(load => {
      const loadDate = new Date(load.date);
      if (loadDate >= today && loadDate <= fiveDaysLater && load.status !== 'Entregado') {
        alerts.push({ id: `prox-${load.id}`, type: 'proximity', title: 'Entrega Próxima', message: `${load.customer} - ${load.date}`, loadId: load.id });
      }
      if (!load.transport || load.transport.trim() === "") {
        alerts.push({ id: `flete-${load.id}`, type: 'missing_data', title: 'Falta Flete', message: `Carga de ${load.customer} sin flete.`, loadId: load.id });
      }
    });
    return alerts;
  }, [loads]);

  const handleNotificationRequest = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotifStatus(permission);
    if (permission === "granted") {
      new Notification("🔔 SII Pallets: ¡Activado!", {
        body: "Recibirás alertas sobre tus cargas y entregas.",
        icon: "/logo192.png"
      });
    }
  };

  const nextOCNumber = useMemo(() => {
    if (internalOCs.length === 0) return "0001";
    const nums = internalOCs.map(o => parseInt(o.ocNumber)).filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return (max + 1).toString().padStart(4, '0');
  }, [internalOCs]);

  const handleSaveLoad = async (e) => {
    e.preventDefault();
    if (!user) return;
    const id = editingId || Date.now().toString();
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'loads', id);
    await setDoc(docRef, { ...newLoad, id, updatedAt: new Date().toISOString() });
    setShowForm(false);
    setEditingId(null);
    setNewLoad(initialLoadState);
  };

  const handleGenerateOC = async (e) => {
    e.preventDefault();
    if (!user) return;
    const ocNumber = nextOCNumber;
    const id = Date.now().toString();
    const ocData = { ...newOC, id, ocNumber, createdAt: new Date().toISOString() };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'internal_ocs', id), ocData);
    setOcSuccess(ocData);
    setShowOCForm(false);
    setNewOC({ customer: "", date: new Date().toISOString().split('T')[0], turn: "", articles: [{ name: "", qty: "" }] });
  };

  const updateQuickStatus = async (id, newStatus) => {
    if (!user) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loads', id), { status: newStatus });
    setQuickStatusLoad(null);
  };

  const deleteLoad = async (id) => {
    if (!user) return;
    if (window.confirm("¿Seguro que deseas eliminar esta carga?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loads', id));
    }
  };

  const printOC = (oc) => {
    const printWindow = window.open('', '_blank');
    const content = `<html><head><title>OC ${oc.ocNumber}</title><style>body{font-family:sans-serif;padding:40px;color:#333;}.header{text-align:center;border-bottom:2px solid #065f46;padding-bottom:20px;}.details{margin-top:30px;display:grid;grid-template-cols:1fr 1fr;gap:20px;}.table{width:100%;border-collapse:collapse;margin-top:20px;}.table th,.table td{border:1px solid #ddd;padding:12px;text-align:left;}.table th{background:#f4f4f4;}.footer{margin-top:50px;font-size:11px;text-align:center;color:#94a3b8;}</style></head><body><div class="header"><h1>ORDEN DE COMPRA INTERNA</h1><p>SII PALLETS LOGÍSTICA</p></div><div class="details"><div><p><strong>N° OC:</strong> #${oc.ocNumber}</p><p><strong>Cliente:</strong> ${oc.customer.toUpperCase()}</p></div><div style="text-align:right;"><p><strong>Fecha:</strong> ${oc.date}</p><p><strong>Turno/Ref:</strong> ${oc.turn || 'N/A'}</p></div></div><table class="table"><thead><tr><th>Producto</th><th>Detalle/Cantidad</th></tr></thead><tbody>${oc.articles.map(a => `<tr><td>${a.name.toUpperCase()}</td><td>${a.qty}</td></tr>`).join('')}</tbody></table><div class="footer">Generado por SII Pallets - ${new Date().toLocaleString()}</div><script>window.onload=function(){window.print();window.close();}</script></body></html>`;
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const formatOCWhatsApp = (oc) => {
    const art = oc.articles.map(a => `• *${a.name.toUpperCase()}*: ${a.qty}`).join('\n');
    return `*📄 ORDEN DE COMPRA INTERNA #${oc.ocNumber}*\n*SII PALLETS LOGÍSTICA*\n\n👤 *Cliente:* ${oc.customer.toUpperCase()}\n📅 *Fecha:* ${oc.date}\n⏰ *Turno/Ref:* ${oc.turn || 'N/A'}\n\n*DETALLE:*\n${art}\n\n_Generado vía APP SII PALLETS_`;
  };

  const formatWhatsAppMessage = (load) => {
    const articulosStr = load.articles?.filter(a => a.name).map(a => `  • ${a.name} (${a.feature || 'S/D'})`).join('\n') || '';
    return `*📦 REPORTE DE ENTREGA - SII PALLETS*\n👤 *Cliente:* ${load.customer.toUpperCase()}\n📅 *Fecha:* ${load.date}\n⏰ *Hora:* ${load.time}hs\n📄 *OC:* ${load.poNumber || 'N/A'}\n🚚 *Transporte:* ${load.transport || 'S/D'}\n📦 *Pallets:* ${load.pallets}\n✅ *Estado:* ${load.status.toUpperCase()}`;
  };

  const copyToClipboard = (text) => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = [];
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(new Date(year, month, d));
    return days;
  }, [currentDate]);

  const filteredDayLoads = useMemo(() => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    return loads.filter(l => l.date === dateStr && (l.customer.toLowerCase().includes(searchQuery.toLowerCase()) || (l.poNumber && l.poNumber.toLowerCase().includes(searchQuery.toLowerCase()))));
  }, [loads, selectedDate, searchQuery]);

  if (loading && !authInitialized) return <div className="h-screen flex items-center justify-center bg-emerald-900 text-white font-black uppercase tracking-widest text-center italic">CONECTANDO A SII PALLETS...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-24 overflow-x-hidden antialiased">
      
      {/* HEADER */}
      <header className="bg-emerald-800 text-white p-6 rounded-b-[2.5rem] shadow-xl relative overflow-hidden flex-shrink-0">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 -mr-16 -mt-16 rounded-full"></div>
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none italic">SII PALLETS</h1>
            <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-200 bg-emerald-900/40 px-3 py-1 rounded-full mt-3 w-fit border border-emerald-500/20">
              <Cloud size={10} className="animate-pulse" /> NUBE CONECTADA
            </div>
          </div>
          <button onClick={() => setShowAlerts(true)} className="p-3 bg-white/10 rounded-2xl border border-white/10 active:scale-95 transition-all relative">
            {notifStatus === 'granted' ? <BellRing size={20} className="text-amber-400" /> : <Bell size={20} />}
            {internalAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-emerald-800 animate-bounce">
                {internalAlerts.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex justify-between items-center bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/10">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 active:scale-90 transition-all"><ChevronLeft size={20} /></button>
          <h2 className="text-xs font-black uppercase tracking-widest">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 active:scale-90 transition-all"><ChevronRight size={20} /></button>
        </div>
      </header>

      {/* MAIN DASHBOARD */}
      <main className="px-5 -mt-6 relative z-20">
        
        {/* CALENDARIO */}
        <div className="bg-white rounded-[2.5rem] shadow-xl p-6 border border-slate-100 mb-8">
          <div className="grid grid-cols-7 gap-1 text-center mb-4 text-[9px] font-black text-slate-300 uppercase">
            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => <div key={`cal-hdr-${d}-${i}`}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((date, idx) => {
              const dStr = date ? date.toISOString().split('T')[0] : `empty-${idx}`;
              const isSelected = date && dStr === selectedDate.toISOString().split('T')[0];
              const hasEvents = date && loads.some(l => l.date === dStr);
              return (
                <button key={`cal-btn-${dStr}-${idx}`} disabled={!date} onClick={() => setSelectedDate(date)}
                  className={`h-10 rounded-2xl flex flex-col items-center justify-center relative transition-all
                    ${!date ? 'opacity-0' : 'opacity-100'}
                    ${isSelected ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-slate-50 text-slate-400 active:scale-95'}
                  `}
                >
                  <span className="text-xs font-black">{date?.getDate()}</span>
                  {hasEvents && !isSelected && <div className="w-1 h-1 rounded-full bg-emerald-400 mt-0.5"></div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ACCIONES RÁPIDAS */}
        <div className="grid grid-cols-2 gap-4 mb-8">
           <button onClick={() => { setEditingId(null); setNewLoad(initialLoadState); setShowForm(true); }}
            className="bg-emerald-800 text-white p-5 rounded-[2rem] shadow-lg flex flex-col items-center gap-2 active:scale-95 transition-all">
             <Plus size={24} />
             <span className="text-[10px] font-black uppercase tracking-widest leading-none">Nueva Entrega</span>
           </button>
           <button onClick={() => setShowOCForm(true)}
            className="bg-indigo-700 text-white p-5 rounded-[2rem] shadow-lg flex flex-col items-center gap-2 active:scale-95 transition-all">
             <FilePlus size={24} />
             <span className="text-[10px] font-black uppercase tracking-widest leading-none">Generar OC</span>
           </button>
        </div>

        {/* BUSCADOR */}
        <div className="relative mb-8">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input type="text" placeholder="Buscar Cliente u OC..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-slate-50 rounded-3xl py-4 pl-14 pr-6 shadow-sm text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" />
        </div>

        {/* LISTADO DE ENTREGAS */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-4 mb-2 flex items-center gap-2 italic">
            <ClipboardList className="w-4 h-4" /> Hoja de Ruta - {selectedDate.toLocaleDateString()}
          </h3>
          {filteredDayLoads.length > 0 ? filteredDayLoads.map(load => {
            const needsFreight = !load.transport || load.transport.trim() === "";
            return (
              <div key={`load-card-${load.id}`} 
                className={`bg-white p-6 rounded-[2.5rem] shadow-sm border relative group transition-all duration-500
                ${needsFreight ? 'border-rose-300 ring-4 ring-rose-50 animate-[pulse_3s_infinite]' : 'border-slate-100 hover:border-emerald-100'}`} 
                onClick={() => setViewLoad(load)}>
                
                <div className="flex justify-between items-start mb-4">
                   <div className="flex-1">
                     <button onClick={(e) => { e.stopPropagation(); setQuickStatusLoad(load); }}
                      className={`text-[8px] font-black uppercase px-2 py-1 rounded-full shadow-sm transition-all active:scale-90 ${
                        load.status === 'Entregado' ? 'bg-emerald-100 text-emerald-700' : 
                        load.status === 'En Proceso' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>{load.status}</button>
                     <h4 className="font-black text-slate-900 text-lg uppercase mt-2 leading-tight flex items-center gap-2">
                       {load.customer}
                       <Eye size={14} className="text-slate-200" />
                     </h4>
                   </div>
                   <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setEditingId(load.id); setNewLoad(load); setShowForm(true); }} className="p-2 text-slate-200 hover:text-blue-500 active:scale-110 transition-all"><Edit3 size={18} /></button>
                      <button onClick={() => deleteLoad(load.id)} className="p-2 text-slate-200 hover:text-rose-500 active:scale-110 transition-all"><Trash2 size={18} /></button>
                   </div>
                </div>

                {needsFreight && (
                  <div className="absolute top-6 right-16 bg-rose-500 text-white text-[7px] font-black uppercase px-2 py-1 rounded-md animate-pulse shadow-lg shadow-rose-200">
                    Falta Flete
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-slate-400 mb-4 bg-slate-50/50 p-3 rounded-2xl border border-slate-50">
                  <div className="flex items-center gap-1"><Clock size={12} className="text-slate-300" /> {load.time} HS</div>
                  <div className="flex items-center gap-1"><Package size={12} className="text-emerald-500" /> {load.pallets} PLTS</div>
                  <div className="flex items-center gap-1"><Hash size={12} className="text-slate-300" /> OC: {load.poNumber || 'S/N'}</div>
                  <div className="flex items-center gap-1"><ListOrdered size={12} className="text-amber-500" /> Turno: {load.turnNumber || '0'}</div>
                </div>

                {load.articles && load.articles.length > 0 && load.articles[0].name && (
                  <div className="border-t border-slate-50 pt-3 mt-1">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-2 flex items-center gap-1 italic">
                      <ListFilter size={10} className="text-emerald-400" /> Detalle de Productos:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {load.articles.map((art, artIdx) => (
                        <div key={`${load.id}-art-view-${artIdx}`} className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase text-slate-700">{art.name}</span>
                          {art.feature && <span className="text-[8px] font-bold text-slate-400 italic">({art.feature})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="text-center py-16 bg-slate-200/20 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center">
              <Package size={40} className="text-slate-200 mb-4" />
              <p className="text-slate-300 font-black uppercase text-[10px] italic tracking-widest">Sin registros para hoy</p>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: ALERTAS */}
      {showAlerts && (
        <div className="fixed inset-0 bg-slate-900/90 z-[160] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-rose-50/50">
              <h2 className="text-xl font-black text-rose-900 uppercase italic tracking-tighter">Notificaciones</h2>
              <button onClick={() => setShowAlerts(false)} className="p-4 bg-white rounded-2xl text-slate-400 active:scale-90 transition-all"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto hide-scrollbar text-center">
              <button onClick={handleNotificationRequest} className="w-full py-4 bg-emerald-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest mb-2 active:scale-95 transition-all">
                {notifStatus === 'granted' ? 'Permisos Activos ✅' : 'Activar Alertas Push'}
              </button>
              {internalAlerts.length > 0 ? internalAlerts.map((alert, i) => (
                <div key={`alert-item-${alert.id}-${i}`} onClick={() => { setViewLoad(loads.find(l => l.id === alert.loadId)); setShowAlerts(false); }}
                  className={`p-5 rounded-3xl border-2 flex items-center gap-5 cursor-pointer text-left hover:scale-[1.02] transition-all
                  ${alert.type === 'proximity' ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100'}`}>
                  <div className={`p-4 rounded-2xl shadow-sm ${alert.type === 'proximity' ? 'bg-white text-amber-600' : 'bg-white text-rose-600'}`}>
                    {alert.type === 'proximity' ? <CalendarIcon size={24} /> : <AlertCircle size={24} />}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-slate-900 leading-tight">{alert.title}</p>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">{alert.message}</p>
                  </div>
                </div>
              )) : (
                <div className="py-10">
                   <Check size={40} className="mx-auto text-emerald-500 mb-2" />
                   <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Sin alertas pendientes</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA OC */}
      {showOCForm && (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] flex items-end justify-center backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[3.5rem] shadow-2xl p-8 overflow-y-auto max-h-[95vh] animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex justify-between items-center mb-8 sticky top-0 bg-white py-2 z-10 border-b border-slate-100">
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase italic">Generar OC</h2>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">N° Sugerido: {nextOCNumber}</p>
              </div>
              <button onClick={() => setShowOCForm(false)} className="p-4 bg-slate-100 rounded-[1.5rem] text-slate-400 active:scale-90"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleGenerateOC} className="space-y-6">
              <input type="text" required value={newOC.customer} onChange={e => setNewOC({...newOC, customer: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-black uppercase placeholder:text-slate-300 shadow-inner" placeholder="NOMBRE DEL CLIENTE" />
              <div className="grid grid-cols-2 gap-4">
                 <input type="date" required value={newOC.date} onChange={e => setNewOC({...newOC, date: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-5 text-sm font-black shadow-inner" />
                 <input type="text" placeholder="Turno / Ref" value={newOC.turn} onChange={e => setNewOC({...newOC, turn: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-black uppercase shadow-inner" />
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between items-center px-2">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Artículos</h3>
                   <button type="button" onClick={() => setNewOC({...newOC, articles: [...newOC.articles, {name:"", qty:""}]})} className="bg-indigo-600 text-white p-2 rounded-xl active:scale-90 shadow-md transition-all"><Plus size={18} /></button>
                 </div>
                 {newOC.articles.map((art, idx) => (
                    <div key={`oc-new-row-${idx}`} className="flex gap-2 animate-in slide-in-from-left-2">
                       <input type="text" placeholder="Producto" required value={art.name} onChange={e => { const u = [...newOC.articles]; u[idx].name = e.target.value; setNewOC({...newOC, articles: u}); }} className="flex-1 bg-slate-50 border-none rounded-2xl p-4 text-xs font-black uppercase shadow-inner" />
                       <input type="text" placeholder="Cant." required value={art.qty} onChange={e => { const u = [...newOC.articles]; u[idx].qty = e.target.value; setNewOC({...newOC, articles: u}); }} className="w-24 bg-slate-50 border-none rounded-2xl p-4 text-xs font-black uppercase text-center shadow-inner" />
                       {newOC.articles.length > 1 && <button type="button" onClick={() => {const u = [...newOC.articles]; u.splice(idx, 1); setNewOC({...newOC, articles: u});}} className="p-2 text-rose-300 active:scale-75 transition-all"><Trash2 size={18}/></button>}
                    </div>
                 ))}
              </div>
              <button type="submit" className="w-full bg-indigo-700 text-white font-black py-6 rounded-[2.5rem] shadow-2xl uppercase tracking-widest text-sm active:scale-95 transition-all">
                <FileText size={20} className="inline mr-2" /> GENERAR OC
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ÉXITO OC */}
      {ocSuccess && (
        <div className="fixed inset-0 bg-slate-900/95 z-[150] flex items-center justify-center p-6 backdrop-blur-md animate-in zoom-in-95">
          <div className="bg-white w-full rounded-[3.5rem] shadow-2xl p-10 flex flex-col items-center text-center">
            <Check size={48} className="text-emerald-600 mb-6 bg-emerald-50 p-2 rounded-full" />
            <h2 className="text-2xl font-black text-slate-800 uppercase italic leading-tight tracking-tighter">OC GENERADA</h2>
            <p className="text-4xl font-black text-emerald-700 mb-8 tracking-tighter italic">N° {ocSuccess.ocNumber}</p>
            <div className="grid grid-cols-1 w-full gap-4">
               <button onClick={() => copyToClipboard(formatOCWhatsApp(ocSuccess))} className={`w-full py-5 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-3 transition-all ${copyFeedback ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-200' : 'bg-emerald-800 text-white shadow-xl active:scale-95'}`}>{copyFeedback ? '¡COPIADO!' : 'COPIAR WHATSAPP'}</button>
               <button onClick={() => printOC(ocSuccess)} className="w-full py-5 bg-slate-50 text-slate-500 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-3 active:bg-slate-100 border-2 border-slate-100 shadow-sm transition-all">IMPRIMIR / PDF</button>
            </div>
            <button onClick={() => setOcSuccess(null)} className="mt-8 text-[10px] font-black text-slate-300 uppercase underline tracking-[0.2em] active:text-slate-500">Cerrar</button>
          </div>
        </div>
      )}

      {/* MODAL: FORMULARIO ENTREGA */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] flex items-end justify-center backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[3.5rem] shadow-2xl p-8 overflow-y-auto max-h-[92%] animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex justify-between items-center mb-8 sticky top-0 bg-white py-2 z-10 border-b border-slate-50">
              <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">{editingId ? 'Editar' : 'Nueva'} Entrega</h2>
              <button onClick={() => setShowForm(false)} className="p-4 bg-slate-100 rounded-[1.5rem] text-slate-400 active:scale-90 transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveLoad} className="space-y-6">
              <div className="flex gap-2">
                {['Pendiente', 'En Proceso', 'Entregado'].map(s => (
                  <button key={`st-btn-form-${s}`} type="button" onClick={() => setNewLoad({...newLoad, status: s})} 
                    className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all 
                    ${newLoad.status === s ? 'bg-emerald-800 border-emerald-800 text-white shadow-xl shadow-emerald-100' : 'bg-white text-slate-300 border-slate-50 hover:border-slate-100'}`}>{s}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="date" required value={newLoad.date} onChange={e => setNewLoad({...newLoad, date: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-4 text-sm font-black shadow-inner" />
                <input type="time" required value={newLoad.time} onChange={e => setNewLoad({...newLoad, time: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-4 text-sm font-black shadow-inner" />
              </div>
              <input type="text" placeholder="Cliente / Destino" required value={newLoad.customer} onChange={e => setNewLoad({...newLoad, customer: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-black uppercase shadow-inner" />
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Turno N°" required value={newLoad.turnNumber} onChange={e => setNewLoad({...newLoad, turnNumber: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-5 text-sm font-black text-emerald-600 shadow-inner" />
                <input type="text" placeholder="OC-" value={newLoad.poNumber} onChange={e => setNewLoad({...newLoad, poNumber: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-5 text-sm font-black uppercase shadow-inner" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Pallets" required value={newLoad.pallets} onChange={e => setNewLoad({...newLoad, pallets: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-5 text-sm font-black shadow-inner" />
                <input type="text" placeholder="Flete" value={newLoad.transport} onChange={e => setNewLoad({...newLoad, transport: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-5 text-sm font-black shadow-inner" />
              </div>

              <div className="space-y-4">
                 <div className="flex justify-between items-center px-2">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Productos</h3>
                   <button type="button" onClick={() => setNewLoad(p => ({...p, articles: [...p.articles, {name:"", feature:""}]}))} className="bg-emerald-700 text-white p-2 rounded-xl active:scale-90 shadow-md transition-all"><Plus size={16} /></button>
                 </div>
                 {newLoad.articles.map((art, idx) => (
                    <div key={`edit-art-line-${idx}`} className="flex gap-2">
                       <input type="text" placeholder="Producto" required value={art.name} onChange={e => { const u = [...newLoad.articles]; u[idx].name = e.target.value; setNewLoad({...newLoad, articles: u}); }} className="flex-1 bg-slate-50 border-none rounded-2xl p-4 text-[11px] font-black uppercase shadow-inner" />
                       <input type="text" placeholder="Obs" value={art.feature} onChange={e => { const u = [...newLoad.articles]; u[idx].feature = e.target.value; setNewLoad({...newLoad, articles: u}); }} className="w-24 bg-slate-50 border-none rounded-2xl p-4 text-[11px] font-black uppercase text-center shadow-inner" />
                       {newLoad.articles.length > 1 && <button type="button" onClick={() => {const u = [...newLoad.articles]; u.splice(idx, 1); setNewLoad({...newLoad, articles: u});}} className="p-2 text-rose-300 active:scale-75 transition-all"><Trash2 size={18}/></button>}
                    </div>
                 ))}
              </div>

              <button type="submit" className="w-full bg-emerald-800 text-white font-black py-6 rounded-[2.5rem] shadow-2xl uppercase tracking-widest text-sm active:scale-95 transition-all flex items-center justify-center gap-3"><Save size={20} /> GUARDAR</button>
            </form>
          </div>
        </div>
      )}

      {/* SELECTOR DE ESTADO RÁPIDO */}
      {quickStatusLoad && (
        <div className="fixed inset-0 bg-slate-900/60 z-[150] flex items-center justify-center p-12 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xs rounded-[3rem] shadow-2xl p-8 animate-in zoom-in-95">
            <h3 className="text-center font-black text-slate-400 text-[10px] uppercase mb-8 tracking-widest italic leading-relaxed">Actualizar Estado</h3>
            <div className="space-y-4">
              {['Pendiente', 'En Proceso', 'Entregado'].map(s => (
                <button key={`quick-opt-sel-${s}`} onClick={() => updateQuickStatus(quickStatusLoad.id, s)}
                  className={`w-full py-5 rounded-[1.5rem] font-black uppercase text-xs transition-all border-4 
                    ${quickStatusLoad.status === s ? 'bg-emerald-800 border-emerald-800 text-white shadow-xl' : 'bg-slate-50 border-slate-50 text-slate-400 active:scale-95'}`}>
                  {s}
                </button>
              ))}
              <button onClick={() => setQuickStatusLoad(null)} className="w-full py-4 text-[10px] font-black text-rose-400 uppercase mt-4 active:bg-rose-50 rounded-2xl transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE (VISTA COMPLETA) */}
      {viewLoad && (
        <div className="fixed inset-0 bg-slate-900/95 z-[140] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-emerald-800 text-white flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black uppercase italic leading-tight tracking-tighter">{viewLoad.customer}</h2>
                <p className="text-emerald-200 text-[10px] font-bold mt-2 uppercase tracking-widest">{viewLoad.date} • {viewLoad.time} HS</p>
              </div>
              <button onClick={() => setViewLoad(null)} className="p-3 bg-white/10 rounded-2xl active:scale-90 transition-all"><X size={20}/></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] hide-scrollbar bg-white">
              {(!viewLoad.transport || viewLoad.transport.trim() === "") && (
                <div className="bg-rose-50 border-2 border-rose-100 p-5 rounded-[2rem] flex items-center gap-4 animate-pulse shadow-sm">
                   <div className="bg-white p-2 rounded-xl text-rose-600 shadow-sm"><AlertTriangle size={24} /></div>
                   <div>
                     <p className="text-[11px] font-black text-rose-900 uppercase">Falta Asignar Flete</p>
                     <p className="text-[10px] font-bold text-rose-500 uppercase leading-none mt-1 italic">Requiere completar este dato</p>
                   </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                   <p className="text-[9px] font-black text-slate-300 uppercase italic">Referencia OC</p>
                   <p className="text-sm font-black">{viewLoad.poNumber || 'S/N'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                   <p className="text-[9px] font-black text-slate-300 uppercase italic">Turno Asignado</p>
                   <p className="text-sm font-black text-emerald-600">#{viewLoad.turnNumber || '-'}</p>
                </div>
              </div>

              <div className={`p-6 rounded-[2.5rem] border-2 transition-colors ${!viewLoad.transport ? 'bg-slate-50 border-slate-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center gap-2 italic"><Truck size={14}/> Datos Logística</p>
                <p className={`text-sm font-black ${!viewLoad.transport ? 'text-slate-300 italic' : 'text-emerald-900'}`}>
                  {viewLoad.transport || 'Transporte pendiente'}
                </p>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                  <Package size={18} className="text-emerald-500"/>
                  <p className="text-xl font-black text-emerald-900 tracking-tighter">{viewLoad.pallets} Pallets Totales</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest italic">Productos</p>
                <div className="space-y-2">
                   {viewLoad.articles?.map((art, i) => (
                      <div key={`view-art-line-${i}`} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex justify-between items-center transition-all hover:bg-slate-50">
                         <span className="text-xs font-black uppercase text-slate-800">{art.name}</span>
                         <span className="text-[10px] font-bold text-slate-400 italic">{art.feature}</span>
                      </div>
                   ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t flex gap-3">
               <button onClick={() => {setEditingId(viewLoad.id); setNewLoad(viewLoad); setShowForm(true); setViewLoad(null);}} className="flex-1 py-5 bg-white border-2 border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-400 active:scale-95 transition-all">Editar</button>
               <button onClick={() => {setShareLoad(viewLoad); setViewLoad(null);}} className="flex-1 py-5 bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">Reporte</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WHATSAPP CARGA */}
      {shareLoad && (
        <div className="fixed inset-0 bg-slate-900/90 z-[160] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-800 uppercase italic flex items-center gap-4 tracking-tighter"><Share2 size={24} className="text-emerald-700" /> Reporte SII</h2>
              <button onClick={() => setShareLoad(null)} className="p-3 bg-slate-100 rounded-full text-slate-300 active:scale-90 transition-all"><X size={20} /></button>
            </div>
            <div className="flex-1 bg-slate-50 rounded-[2.5rem] p-8 overflow-y-auto mb-10 border-2 border-slate-100 shadow-inner">
              <pre className="text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">{formatWhatsAppMessage(shareLoad)}</pre>
            </div>
            <button onClick={() => copyToClipboard(formatWhatsAppMessage(shareLoad))}
              className={`w-full py-7 rounded-[2.5rem] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-4 transition-all shadow-xl ${copyFeedback ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-200' : 'bg-emerald-800 text-white active:scale-95'}`}>
              {copyFeedback ? '¡COPIADO!' : 'COPIAR PARA WHATSAPP'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
