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
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  Plus, X, Package, Truck, Calendar as CalendarIcon, 
  ChevronLeft, ChevronRight, Clock, Hash, Trash2, 
  Edit3, BarChart3, Search, ListOrdered, Save, Cloud, 
  Share2, Copy, Check, LayoutDashboard, Bell, BellRing, 
  AlertTriangle, Eye, ListFilter, CalendarDays, ArrowRight
} from 'lucide-react';

// --- CONFIGURACIÓN DE TU FIREBASE ---
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
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loads, setLoads] = useState([]);
  
  // Nuevos estados para vistas y detalles
  const [viewLoad, setViewLoad] = useState(null); // Modal de detalle
  const [showUpcoming, setShowUpcoming] = useState(false); // Listado 15 días
  const [quickStatusLoad, setQuickStatusLoad] = useState(null); // Selector de estado rápido
  const [shareLoad, setShareLoad] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [notifStatus, setNotifStatus] = useState('default');

  const initialFormState = {
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
  const [newLoad, setNewLoad] = useState(initialFormState);

  useEffect(() => {
    if ("Notification" in window) setNotifStatus(Notification.permission);
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (err) { console.error(err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'loads');
    const unsubscribe = onSnapshot(loadsCollection, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLoads(data);
    });
    return () => unsubscribe();
  }, [user]);

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

  const saveLoad = async (e) => {
    e.preventDefault();
    if (!user) return;
    const id = editingId || Date.now().toString();
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'loads', id);
    try {
      await setDoc(docRef, { ...newLoad, id, updatedAt: new Date().toISOString() });
      setShowForm(false);
      setEditingId(null);
      setNewLoad(initialFormState);
    } catch (err) { console.error(err); }
  };

  const updateQuickStatus = async (id, newStatus) => {
    if (!user) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'loads', id);
    try {
      await updateDoc(docRef, { status: newStatus });
      setQuickStatusLoad(null);
    } catch (err) { console.error(err); }
  };

  const deleteLoad = async (id) => {
    if (!user) return;
    if (confirm("¿Eliminar carga?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loads', id));
    }
  };

  // Filtrado para los próximos 15 días
  const upcomingLoads = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date();
    limit.setDate(today.getDate() + 15);
    limit.setHours(23, 59, 59, 999);

    return loads
      .filter(l => {
        const loadDate = new Date(l.date);
        return loadDate >= today && loadDate <= limit;
      })
      .sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));
  }, [loads]);

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

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
    return loads.filter(l => {
      const matchesDate = l.date === dateStr;
      return matchesDate && (l.customer.toLowerCase().includes(searchQuery.toLowerCase()) || l.poNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    });
  }, [loads, selectedDate, searchQuery]);

  const totalPalletsDay = filteredDayLoads.reduce((acc, curr) => acc + (Number(curr.pallets) || 0), 0);

  const formatWhatsAppMessage = (load) => {
    const articulosStr = load.articles?.filter(a => a.name).map(a => `  • ${a.name} (${a.feature || 'S/D'})`).join('\n') || '';
    return `*📦 REPORTE DE ENTREGA - SII PALLETS*\n👤 *Cliente:* ${load.customer.toUpperCase()}\n📅 *Fecha:* ${load.date}\n⏰ *Hora:* ${load.time}hs\n📄 *OC:* ${load.poNumber || 'N/A'}\n🚚 *Transporte:* ${load.transport || 'S/D'}\n📦 *Pallets:* ${load.pallets}\n✅ *Estado:* ${load.status.toUpperCase()}`;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-emerald-900 text-white font-black uppercase tracking-widest">SII PALLETS...</div>;

  return (
    <div className="min-h-screen bg-slate-100 md:py-8 lg:py-12">
      <div className="max-w-md mx-auto min-h-screen md:min-h-[850px] md:max-h-[95vh] bg-slate-50 flex flex-col relative overflow-hidden md:rounded-[3rem] md:shadow-2xl border-x border-slate-200">
        
        {/* HEADER */}
        <header className="bg-emerald-800 text-white p-6 md:p-8 rounded-b-[2.5rem] shadow-xl relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 -mr-16 -mt-16 rounded-full"></div>
          <div className="flex justify-between items-start mb-6 relative z-10">
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase leading-tight">ENTREGAS<br/>SII PALLETS</h1>
              <div className="flex items-center gap-2 text-[9px] font-bold text-emerald-200 bg-emerald-900/40 px-3 py-1 rounded-full mt-2 w-fit">
                <Cloud size={10} className="animate-pulse" /> SINCRO NUBE OK
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleNotificationRequest}
                className={`p-3 rounded-2xl border border-white/10 active:scale-95 transition-all relative
                  ${notifStatus === 'granted' ? 'bg-amber-500 text-white shadow-lg' : 'bg-emerald-700/50 text-emerald-100'}`}>
                {notifStatus === 'granted' ? <BellRing size={20} /> : <Bell size={20} />}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/10">
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 active:scale-90 transition-transform"><ChevronLeft size={20} /></button>
            <h2 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em]">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 active:scale-90 transition-transform"><ChevronRight size={20} /></button>
          </div>
        </header>

        {/* CONTENIDO SCROLLABLE */}
        <main className="flex-1 overflow-y-auto px-4 pb-32 -mt-6 relative z-20 hide-scrollbar">
          {/* CALENDARIO */}
          <div className="bg-white rounded-[2.5rem] shadow-xl p-6 border border-slate-100">
            <div className="grid grid-cols-7 gap-1 text-center mb-4 text-[9px] font-black text-slate-300 uppercase">{['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => <div key={d}>{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-2 md:gap-3">
              {calendarDays.map((date, idx) => {
                const isSelected = date && date.toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0];
                const dateStr = date?.toISOString().split('T')[0];
                const hasEvents = loads.some(l => l.date === dateStr);
                return (
                  <button key={idx} disabled={!date} onClick={() => setSelectedDate(date)}
                    className={`h-10 md:h-12 w-full rounded-2xl flex flex-col items-center justify-center relative transition-all active:scale-95
                      ${!date ? 'opacity-0' : 'opacity-100'}
                      ${isSelected ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105 z-10' : 'bg-slate-50 text-slate-600'}
                    `}
                  >
                    <span className="text-[10px] md:text-xs font-black">{date?.getDate()}</span>
                    {hasEvents && !isSelected && <div className="w-1.5 h-1.5 rounded-full mt-0.5 bg-emerald-400"></div>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DASHBOARD CON BOTÓN PRÓXIMAS */}
          <div className="mt-8 grid grid-cols-1 gap-4 mb-6">
            <button onClick={() => setShowUpcoming(true)} 
              className="bg-indigo-600 text-white p-5 rounded-[2rem] shadow-lg flex items-center justify-between group active:scale-[0.98] transition-all">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-2xl"><CalendarDays size={24} /></div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Próximas Entregas</p>
                  <p className="text-lg font-black leading-none mt-1">Siguientes 15 días</p>
                </div>
              </div>
              <ArrowRight className="group-hover:translate-x-1 transition-transform" />
            </button>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Pallets Día</p>
                <p className="text-3xl font-black text-emerald-700 leading-none mt-2">{totalPalletsDay}</p>
              </div>
              <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Entregas Hoy</p>
                <p className="text-3xl font-black text-indigo-700 leading-none mt-2">{filteredDayLoads.length}</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" placeholder="Buscar Cliente u OC..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border-2 border-slate-50 rounded-3xl py-4 pl-14 pr-6 shadow-sm text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all" />
            </div>
          </div>

          {/* LISTADO DE ENTREGAS DEL DÍA */}
          <div className="space-y-4 pb-12">
            {filteredDayLoads.map(load => (
              <div key={load.id} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden group">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1" onClick={() => setViewLoad(load)}>
                      <button onClick={(e) => { e.stopPropagation(); setQuickStatusLoad(load); }}
                        className={`text-[8px] font-black uppercase px-2 py-1 rounded-full transition-colors ${
                          load.status === 'Completado' ? 'bg-emerald-100 text-emerald-700' : 
                          load.status === 'En Proceso' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                        {load.status}
                      </button>
                      <h4 className="font-black text-slate-900 text-lg uppercase mt-2 leading-tight flex items-center gap-2">
                        {load.customer} <Eye size={14} className="text-slate-300" />
                      </h4>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setShareLoad(load)} className="p-2 text-slate-300 hover:text-emerald-500"><Share2 size={18} /></button>
                      <button onClick={() => { setEditingId(load.id); setNewLoad(load); setShowForm(true); }} className="p-2 text-slate-300 hover:text-emerald-600"><Edit3 size={18} /></button>
                      <button onClick={() => deleteLoad(load.id)} className="p-2 text-slate-300 hover:text-rose-500"><Trash2 size={18} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-slate-500 mb-2" onClick={() => setViewLoad(load)}>
                    <div className="flex items-center gap-2 truncate"><Hash size={12} className="text-emerald-500" /> OC: {load.poNumber || '-'}</div>
                    <div className="flex items-center gap-2"><ListOrdered size={12} className="text-amber-500" /> Turno: {load.turnNumber || '-'}</div>
                    <div className="flex items-center gap-2"><Package size={12} className="text-emerald-500" /> {load.pallets} Plts</div>
                    <div className="flex items-center gap-2"><Clock size={12} className="text-slate-400" /> {load.time} HS</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>

        <div className="absolute bottom-10 left-0 right-0 flex justify-center px-6 z-50 pointer-events-none">
          <button onClick={() => { setEditingId(null); setNewLoad(initialFormState); setShowForm(true); }}
            className="pointer-events-auto bg-emerald-800 text-white flex items-center gap-3 px-10 py-5 rounded-full shadow-2xl border-4 border-white active:scale-95 transition-all">
            <Plus size={24} className="stroke-[4px]" /><span className="font-black text-sm uppercase tracking-tight">NUEVA CARGA</span>
          </button>
        </div>

        {/* MODAL PRÓXIMAS ENTREGAS (15 DÍAS) */}
        {showUpcoming && (
          <div className="absolute inset-0 bg-slate-900/90 z-[80] flex items-end justify-center backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full h-[90%] rounded-t-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-500">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-indigo-50">
                <div>
                  <h2 className="text-2xl font-black text-indigo-900 uppercase leading-none">Próximos 15 días</h2>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Listado de Previsión</p>
                </div>
                <button onClick={() => setShowUpcoming(false)} className="p-4 bg-white rounded-[1.5rem] shadow-sm text-slate-400"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 hide-scrollbar">
                {upcomingLoads.length > 0 ? (
                  upcomingLoads.map(l => (
                    <div key={l.id} className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex items-center justify-between" onClick={() => { setViewLoad(l); setShowUpcoming(false); }}>
                      <div className="flex items-center gap-4">
                        <div className="text-center bg-white p-2 rounded-2xl min-w-[50px] shadow-sm">
                          <p className="text-[8px] font-black text-indigo-500 uppercase">{l.date.split('-')[1]}</p>
                          <p className="text-lg font-black text-slate-800 leading-none">{l.date.split('-')[2]}</p>
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 uppercase leading-tight">{l.customer}</p>
                          <p className="text-[10px] font-bold text-slate-400">{l.time}hs • {l.pallets} Pallets</p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-300" />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-20 text-slate-300 font-black uppercase text-xs">No hay entregas programadas</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL DETALLE DE ENTREGA */}
        {viewLoad && (
          <div className="absolute inset-0 bg-slate-900/95 z-[90] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white w-full max-h-[85vh] rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
              <div className="p-8 bg-emerald-800 text-white flex justify-between items-start">
                <div>
                  <span className="text-[9px] font-black bg-white/20 px-2 py-1 rounded-full uppercase mb-2 inline-block">ID: {viewLoad.id.slice(-6)}</span>
                  <h2 className="text-2xl font-black uppercase leading-tight">{viewLoad.customer}</h2>
                  <p className="text-emerald-100 text-sm font-bold flex items-center gap-2 mt-1"><Clock size={16} /> {viewLoad.date} • {viewLoad.time}hs</p>
                </div>
                <button onClick={() => setViewLoad(null)} className="p-3 bg-white/10 rounded-2xl text-white"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6 hide-scrollbar text-slate-600">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-3xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Orden Compra</p>
                    <p className="text-sm font-black text-slate-800">{viewLoad.poNumber || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-3xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Turno N°</p>
                    <p className="text-sm font-black text-emerald-600">{viewLoad.turnNumber || '-'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-3xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Pallets Totales</p>
                    <p className="text-sm font-black text-slate-800">{viewLoad.pallets} Plts</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-3xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Estado</p>
                    <p className="text-sm font-black uppercase">{viewLoad.status}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-2"><Truck size={12} /> Logística</p>
                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                      <p className="text-sm font-bold text-slate-800 mb-1">{viewLoad.transport || 'Transporte no especificado'}</p>
                      <p className="text-xs text-slate-500 italic leading-relaxed">{viewLoad.condition || 'Sin observaciones de equipo.'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest flex items-center gap-2"><Package size={12} /> Artículos</p>
                    <div className="space-y-2">
                      {viewLoad.articles?.map((art, i) => (
                        <div key={i} className="flex justify-between items-center bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                          <span className="text-xs font-black uppercase text-slate-800">{art.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 italic">{art.feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t flex gap-3">
                <button onClick={() => { setShareLoad(viewLoad); setViewLoad(null); }} className="flex-1 bg-emerald-700 text-white py-4 rounded-3xl font-black uppercase text-xs flex items-center justify-center gap-2">
                  <Share2 size={16} /> Compartir
                </button>
                <button onClick={() => { setEditingId(viewLoad.id); setNewLoad(viewLoad); setShowForm(true); setViewLoad(null); }} className="flex-1 bg-white border-2 border-slate-200 py-4 rounded-3xl font-black uppercase text-xs flex items-center justify-center gap-2">
                  <Edit3 size={16} /> Editar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL SELECTOR DE ESTADO RÁPIDO */}
        {quickStatusLoad && (
          <div className="absolute inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-12 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full rounded-[3rem] shadow-2xl p-8 animate-in zoom-in-95">
              <h3 className="text-center font-black text-slate-400 text-[10px] uppercase mb-6 tracking-widest italic">Cambiar Estado de Entrega</h3>
              <div className="space-y-3">
                {['Pendiente', 'En Proceso', 'Completado'].map(s => (
                  <button key={s} onClick={() => updateQuickStatus(quickStatusLoad.id, s)}
                    className={`w-full py-5 rounded-3xl font-black uppercase text-xs transition-all border-4 
                      ${quickStatusLoad.status === s ? 'bg-emerald-800 border-emerald-800 text-white' : 'bg-slate-50 border-slate-50 text-slate-400'}`}>
                    {s}
                  </button>
                ))}
                <button onClick={() => setQuickStatusLoad(null)} className="w-full py-3 text-[10px] font-black text-rose-400 uppercase mt-4">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL REPORTE WHATSAPP */}
        {shareLoad && (
          <div className="absolute inset-0 bg-slate-900/90 z-[70] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
            <div className="bg-white w-full rounded-[2.5rem] shadow-2xl p-8 max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-800 uppercase flex items-center gap-2"><Share2 size={20} className="text-emerald-600" /> Detalle Entrega</h2>
                <button onClick={() => setShareLoad(null)} className="p-2 bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
              </div>
              <div className="flex-1 bg-slate-50 rounded-3xl p-5 overflow-y-auto mb-6 border border-slate-100 font-sans">
                <pre className="text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">{formatWhatsAppMessage(shareLoad)}</pre>
              </div>
              <button onClick={() => copyToClipboard(formatWhatsAppMessage(shareLoad))}
                className={`w-full py-4 rounded-3xl font-black uppercase text-sm flex items-center justify-center gap-3 transition-all ${copyFeedback ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-700 text-white shadow-lg active:scale-95'}`}>
                {copyFeedback ? <><Check size={18} /> ¡Copiado!</> : <><Copy size={18} /> Copiar para WhatsApp</>}
              </button>
            </div>
          </div>
        )}

        {/* MODAL FORMULARIO (EDICIÓN/NUEVO) */}
        {showForm && (
          <div className="absolute inset-0 bg-slate-900/90 z-[60] flex items-end justify-center backdrop-blur-sm animate-in fade-in px-2 md:px-4">
            <div className="bg-white w-full rounded-t-[3.5rem] shadow-2xl p-8 overflow-y-auto max-h-[92%] animate-in slide-in-from-bottom duration-500 hide-scrollbar">
              <div className="flex justify-between items-center mb-8 sticky top-0 bg-white py-2 z-10 border-b border-slate-50">
                <div><h2 className="text-2xl font-black text-slate-800 uppercase italic leading-none">{editingId ? 'Editar' : 'Nueva'} Entrega</h2><p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">SISTEMA SII PALLETS</p></div>
                <button onClick={() => setShowForm(false)} className="p-4 bg-slate-100 rounded-[1.5rem] text-slate-400"><X size={24} /></button>
              </div>
              <form onSubmit={saveLoad} className="space-y-6 pb-12">
                <div className="flex gap-2">{['Pendiente', 'En Proceso', 'Completado'].map(s => (
                  <button key={s} type="button" onClick={() => setNewLoad({...newLoad, status: s})} className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase border-2 transition-all ${newLoad.status === s ? 'bg-emerald-800 border-emerald-800 text-white shadow-md' : 'bg-white text-slate-300 border-slate-50'}`}>{s}</button>
                ))}</div>
                <div className="grid grid-cols-2 gap-4">
                  <input type="date" required value={newLoad.date} onChange={e => setNewLoad({...newLoad, date: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-4 text-sm font-black focus:ring-2 focus:ring-emerald-500" />
                  <input type="time" required value={newLoad.time} onChange={e => setNewLoad({...newLoad, time: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-4 text-sm font-black focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div className="space-y-4 bg-slate-50 p-6 rounded-[2.5rem]">
                  <input type="text" placeholder="Cliente / Destino" required value={newLoad.customer} onChange={e => setNewLoad({...newLoad, customer: e.target.value})} className="w-full bg-white border border-slate-200 rounded-2xl p-4 text-sm font-black uppercase" />
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Turno N°" required value={newLoad.turnNumber} onChange={e => setNewLoad({...newLoad, turnNumber: e.target.value})} className="bg-white border border-slate-200 rounded-2xl p-4 text-sm font-black text-emerald-600" />
                    <input type="text" placeholder="OC-" value={newLoad.poNumber} onChange={e => setNewLoad({...newLoad, poNumber: e.target.value})} className="bg-white border border-slate-200 rounded-2xl p-4 text-sm font-black font-mono uppercase" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="Pallets" required value={newLoad.pallets} onChange={e => setNewLoad({...newLoad, pallets: e.target.value})} className="bg-emerald-50 border-none rounded-2xl p-4 text-sm font-black" />
                  <input type="text" placeholder="Transporte" value={newLoad.transport} onChange={e => setNewLoad({...newLoad, transport: e.target.value})} className="bg-emerald-50 border-none rounded-2xl p-4 text-sm font-black" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Lista de Artículos</label>
                  <div className="space-y-3">
                    {newLoad.articles?.map((art, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <div className="flex-1 bg-white border border-slate-100 p-4 rounded-3xl shadow-sm">
                          <input type="text" placeholder="Producto" required value={art.name} onChange={e => { const u = [...newLoad.articles]; u[index].name = e.target.value; setNewLoad({...newLoad, articles: u}); }} className="w-full border-none text-xs p-0 focus:ring-0 font-black uppercase" />
                          <input type="text" placeholder="Detalle (Peso...)" value={art.feature} onChange={e => { const u = [...newLoad.articles]; u[index].feature = e.target.value; setNewLoad({...newLoad, articles: u}); }} className="w-full border-none text-[9px] p-0 mt-1 focus:ring-0 text-slate-400 italic" />
                        </div>
                        {newLoad.articles.length > 1 && <button type="button" onClick={() => { const u = [...newLoad.articles]; u.splice(index, 1); setNewLoad({...newLoad, articles: u}); }} className="p-2 text-rose-300"><Trash2 size={18} /></button>}
                      </div>
                    ))}
                    <button type="button" onClick={() => setNewLoad(p => ({...p, articles: [...p.articles, {name:"", feature:""}]}))} className="w-full py-3 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase">+ Agregar Artículo</button>
                  </div>
                </div>
                <button type="submit" className="w-full bg-emerald-800 text-white font-black py-5 rounded-[2.5rem] shadow-2xl uppercase tracking-widest text-xs flex items-center justify-center gap-3 active:scale-95 transition-all"><Save size={18} /> {editingId ? 'Guardar Cambios' : 'Registrar Entrega'}</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
