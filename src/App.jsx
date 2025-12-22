import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  Plus, X, Package, Truck, Calendar as CalendarIcon, 
  ChevronLeft, ChevronRight, Clock, Hash, Trash2, 
  Edit3, BarChart3, AlertCircle, Search, ListOrdered,
  Save, Cloud, Bell, BellRing
} from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE (Tus credenciales) ---
const firebaseConfig = {
  apiKey: "AIzaSyBF-7P8QhcOQb4KnlxacCDkY3-m1ETvhr0", // El entorno inyectará la clave real si es necesario
  authDomain: "entregas-sii-pallets.firebaseapp.com",
  projectId: "entregas-sii-pallets",
  storageBucket: "entregas-sii-pallets.firebasestorage.app",
  messagingSenderId: "42949067833",
  appId: "1:42949067833:web:37b0257a9e0b8c2a03e103"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'entregas-sii-pallets';

const App = () => {
  // --- ESTADOS ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loads, setLoads] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // --- FORMULARIO INICIAL ---
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

  // --- AUTH (REGLA 3) ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Error Auth:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- LEER FIRESTORE (REGLA 1 Y 2) ---
  useEffect(() => {
    if (!user) return;
    const loadsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'loads');
    const unsubscribe = onSnapshot(loadsCollection, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLoads(data);
      },
      (error) => console.error("Firestore Error:", error)
    );
    return () => unsubscribe();
  }, [user]);

  // --- LÓGICA DE NOTIFICACIONES ---
  const requestNotificationPermission = () => {
    if (!("Notification" in window)) {
      alert("Este navegador no soporta notificaciones");
      return;
    }
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        setNotificationsEnabled(true);
      }
    });
  };

  // --- LÓGICA CALENDARIO ---
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

  // --- MANEJO DE ARTÍCULOS ---
  const addArticleField = () => {
    setNewLoad(prev => ({
      ...prev,
      articles: [...prev.articles, { name: "", feature: "" }]
    }));
  };

  const updateArticle = (index, field, value) => {
    const updated = [...newLoad.articles];
    updated[index][field] = value;
    setNewLoad({...newLoad, articles: updated});
  };

  const removeArticle = (index) => {
    const updated = [...newLoad.articles];
    updated.splice(index, 1);
    setNewLoad({...newLoad, articles: updated});
  };

  // --- CRUD ---
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

  const deleteLoad = async (id) => {
    if (!user) return;
    if (confirm("¿Eliminar esta carga?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loads', id));
    }
  };

  // --- FILTROS ---
  const filteredDayLoads = useMemo(() => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    return loads.filter(l => {
      const matchesDate = l.date === dateStr;
      const matchesSearch = l.customer.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            l.poNumber.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDate && matchesSearch;
    });
  }, [loads, selectedDate, searchQuery]);

  const totalPalletsDay = filteredDayLoads.reduce((acc, curr) => acc + (Number(curr.pallets) || 0), 0);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-emerald-900 text-white font-black animate-pulse uppercase tracking-widest">
      ENTREGAS SII PALLETS
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col pb-32 relative overflow-x-hidden antialiased">
      
      {/* HEADER */}
      <header className="bg-emerald-800 text-white p-6 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 -mr-16 -mt-16 rounded-full"></div>
        
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-tight">ENTREGAS<br/>SII PALLETS</h1>
            <div className="flex items-center gap-2 text-[9px] font-bold text-emerald-200 bg-emerald-900/40 px-3 py-1 rounded-full mt-2 w-fit border border-emerald-500/20">
              <Cloud size={10} className="animate-pulse" />
              SINCRO FIRESTORE OK
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={requestNotificationPermission}
              className={`p-3 rounded-2xl border border-white/10 transition-all ${notificationsEnabled ? 'bg-amber-500 text-white' : 'bg-emerald-700/50'}`}
            >
              {notificationsEnabled ? <BellRing size={20} /> : <Bell size={20} />}
            </button>
            <button className="bg-emerald-700/50 p-3 rounded-2xl border border-white/10">
              <BarChart3 size={20} />
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/10">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 active:scale-90 transition-transform">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xs font-black uppercase tracking-[0.2em]">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 active:scale-90 transition-transform">
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {/* CALENDARIO */}
      <main className="px-4 -mt-6 relative z-20">
        <div className="bg-white rounded-[2.5rem] shadow-2xl p-6 border border-slate-100">
          <div className="grid grid-cols-7 gap-1 text-center mb-4 text-[10px] font-black text-slate-300">
            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-3">
            {calendarDays.map((date, idx) => {
              const isSelected = date && date.toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0];
              const dateStr = date?.toISOString().split('T')[0];
              const dayLoads = loads.filter(l => l.date === dateStr);
              const pallets = dayLoads.reduce((acc, curr) => acc + (Number(curr.pallets) || 0), 0);
              
              return (
                <button
                  key={idx}
                  disabled={!date}
                  onClick={() => setSelectedDate(date)}
                  className={`h-11 w-full rounded-2xl flex flex-col items-center justify-center relative transition-all active:scale-95
                    ${!date ? 'opacity-0' : 'opacity-100'}
                    ${isSelected ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-110 z-10' : 'bg-slate-50 text-slate-600'}
                  `}
                >
                  <span className="text-xs font-black">{date?.getDate()}</span>
                  {pallets > 0 && !isSelected && (
                    <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${pallets > 30 ? 'bg-rose-500' : 'bg-emerald-400'}`}></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* DASHBOARD */}
        <div className="mt-8 px-2 grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pallets Día</p>
            <p className="text-3xl font-black text-emerald-700 leading-none mt-2">{totalPalletsDay}</p>
          </div>
          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargas</p>
            <p className="text-3xl font-black text-indigo-700 leading-none mt-2">{filteredDayLoads.length}</p>
          </div>
        </div>

        {/* BUSCADOR */}
        <div className="px-2 mb-8">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Buscar Cliente u OC..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border-2 border-slate-50 rounded-3xl py-5 pl-14 pr-6 shadow-sm text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
            />
          </div>
        </div>

        {/* LISTADO DE CARGAS */}
        <div className="space-y-5 px-2 pb-16">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Entregas de hoy</h3>
          </div>
          {filteredDayLoads.length > 0 ? (
            filteredDayLoads.map(load => (
              <div key={load.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative group animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-full ${
                      load.status === 'Completado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {load.status}
                    </span>
                    <h4 className="font-black text-slate-900 text-lg uppercase mt-2 tracking-tight leading-tight">{load.customer}</h4>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingId(load.id); setNewLoad(load); setShowForm(true); }} className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                      <Edit3 size={18} />
                    </button>
                    <button onClick={() => deleteLoad(load.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Hash size={16} className="text-emerald-500" />
                    <span className="text-xs font-bold uppercase tracking-tighter truncate">OC: {load.poNumber || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <ListOrdered size={16} className="text-amber-500" />
                    <span className="text-xs font-bold uppercase tracking-tighter">Turno: {load.turnNumber || '-'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                  <div className="flex gap-4 items-center">
                    <div className="flex items-center gap-1.5 font-black text-emerald-700 text-sm">
                      <Package size={16} /> {load.pallets}
                    </div>
                    <div className="flex items-center gap-1.5 font-bold text-slate-400 text-xs">
                      <Truck size={16} /> <span className="max-w-[80px] truncate">{load.transport}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 font-black text-slate-800 text-xs bg-slate-100 px-3 py-1.5 rounded-xl">
                    <Clock size={14} /> {load.time}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-slate-200/20 rounded-[3rem] border-4 border-dashed border-slate-100">
              <p className="text-slate-300 font-black uppercase text-xs tracking-widest italic">Sin movimientos registrados</p>
            </div>
          )}
        </div>
      </main>

      {/* BOTÓN FLOTANTE */}
      <button 
        onClick={() => { setEditingId(null); setNewLoad(initialFormState); setShowForm(true); }}
        className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-emerald-800 text-white flex items-center gap-3 px-10 py-5 rounded-full shadow-2xl shadow-emerald-200 active:scale-95 transition-all z-50 border-4 border-white"
      >
        <Plus size={24} className="stroke-[4px]" />
        <span className="font-black text-sm tracking-tight uppercase">Registrar Carga</span>
      </button>

      {/* MODAL FORMULARIO */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/90 z-[60] flex items-end justify-center backdrop-blur-sm animate-in fade-in duration-300 px-2">
          <div className="bg-white w-full max-w-md rounded-t-[3.5rem] shadow-2xl p-8 overflow-y-auto max-h-[96vh] animate-in slide-in-from-bottom duration-500">
            <div className="flex justify-between items-center mb-10 sticky top-0 bg-white py-2 z-10 border-b-2 border-slate-50">
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic">{editingId ? 'Editar' : 'Nueva'} Entrega</h2>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Protocolo de carga v2.0</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-4 bg-slate-100 rounded-[1.5rem] text-slate-400 active:bg-rose-100 active:text-rose-500 transition-colors">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={saveLoad} className="space-y-8 pb-12">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Estado Actual</label>
                <div className="flex gap-2">
                  {['Pendiente', 'En Proceso', 'Completado'].map(s => (
                    <button key={s} type="button" onClick={() => setNewLoad({...newLoad, status: s})}
                      className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all
                        ${newLoad.status === s ? 'bg-emerald-800 border-emerald-800 text-white shadow-lg' : 'bg-white text-slate-300 border-slate-100'}`}
                    >{s}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Día</label>
                  <input type="date" required value={newLoad.date} onChange={e => setNewLoad({...newLoad, date: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-black focus:ring-4 focus:ring-emerald-500/10" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Hora</label>
                  <input type="time" required value={newLoad.time} onChange={e => setNewLoad({...newLoad, time: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-black focus:ring-4 focus:ring-emerald-500/10" />
                </div>
              </div>

              <div className="space-y-5 bg-slate-50 p-6 rounded-[2.5rem]">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Identificación del Cliente</label>
                  <input type="text" placeholder="Nombre completo" required value={newLoad.customer} onChange={e => setNewLoad({...newLoad, customer: e.target.value})} className="w-full bg-white border-2 border-slate-100 rounded-2xl p-5 text-sm font-black uppercase placeholder:text-slate-200 focus:border-emerald-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Turno N°</label>
                    <input type="text" placeholder="Ex: 05" required value={newLoad.turnNumber} onChange={e => setNewLoad({...newLoad, turnNumber: e.target.value})} className="bg-white border-2 border-slate-100 rounded-2xl p-5 text-sm font-black text-emerald-600 focus:border-emerald-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Orden Compra</label>
                    <input type="text" placeholder="OC-" value={newLoad.poNumber} onChange={e => setNewLoad({...newLoad, poNumber: e.target.value})} className="bg-white border-2 border-slate-100 rounded-2xl p-5 text-sm font-black font-mono focus:border-emerald-500" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-2">Cant. Pallets</label>
                  <input type="number" required value={newLoad.pallets} onChange={e => setNewLoad({...newLoad, pallets: e.target.value})} className="w-full bg-emerald-50 border-none rounded-2xl p-5 text-sm font-black focus:ring-4 focus:ring-emerald-500/10" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-2">Transportista</label>
                  <input type="text" placeholder="Empresa" value={newLoad.transport} onChange={e => setNewLoad({...newLoad, transport: e.target.value})} className="w-full bg-emerald-50 border-none rounded-2xl p-5 text-sm font-black focus:ring-4 focus:ring-emerald-500/10" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalle de Artículos</h3>
                  <button type="button" onClick={addArticleField} className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-100 active:scale-90 transition-all">
                    <Plus size={20} className="stroke-[4px]" />
                  </button>
                </div>
                <div className="space-y-3">
                  {newLoad.articles.map((art, index) => (
                    <div key={index} className="flex gap-3 items-center group animate-in zoom-in-95 duration-200">
                      <div className="flex-1 bg-white border-2 border-slate-100 p-5 rounded-[2rem] shadow-sm focus-within:border-emerald-200 transition-colors">
                        <input type="text" placeholder="Artículo / Producto" required value={art.name} onChange={e => updateArticle(index, 'name', e.target.value)} className="w-full border-none text-sm p-0 focus:ring-0 font-black uppercase placeholder:text-slate-200" />
                        <input type="text" placeholder="Características (Lote, Peso...)" value={art.feature} onChange={e => updateArticle(index, 'feature', e.target.value)} className="w-full border-none text-[10px] p-0 mt-1 focus:ring-0 text-slate-400 italic" />
                      </div>
                      {newLoad.articles.length > 1 && (
                        <button type="button" onClick={() => removeArticle(index)} className="p-3 text-rose-300 hover:text-rose-500 transition-colors">
                          <Trash2 size={24} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full bg-emerald-800 text-white font-black py-6 rounded-[2.5rem] shadow-2xl shadow-emerald-200 uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 active:scale-95 transition-all">
                <Save size={20} /> {editingId ? 'Guardar Cambios' : 'Registrar Entrega'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
