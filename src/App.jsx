import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
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
  Bell, BellRing, Info
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

// Inicialización de servicios
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'entregas-sii-pallets';

const App = () => {
  // --- ESTADOS DE LA APLICACIÓN ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loads, setLoads] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Estado inicial del formulario
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

  // --- 1. AUTENTICACIÓN ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Error de autenticación:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. ESCUCHA DE DATOS EN TIEMPO REAL ---
  useEffect(() => {
    if (!user) return;
    const loadsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'loads');
    const unsubscribe = onSnapshot(loadsCollection, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLoads(data);
      },
      (error) => console.error("Error leyendo Firestore:", error)
    );
    return () => unsubscribe();
  }, [user]);

  // --- 3. LÓGICA DE CALENDARIO ---
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

  // --- 4. ACCIONES CRUD ---
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
    } catch (err) { console.error("Error al guardar:", err); }
  };

  const deleteLoad = async (id) => {
    if (!user) return;
    if (confirm("¿Seguro que deseas eliminar esta entrega?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loads', id));
    }
  };

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

  // --- 5. FILTROS Y RESUMEN ---
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
    <div className="h-screen flex flex-col items-center justify-center bg-emerald-900 text-white p-6 text-center">
      <h2 className="text-2xl font-black mb-2 animate-pulse uppercase tracking-widest">ENTREGAS SII PALLETS</h2>
      <p className="text-emerald-300 text-xs font-bold">Iniciando conexión segura...</p>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 flex flex-col pb-32 relative antialiased border-x border-slate-200">
      
      {/* HEADER */}
      <header className="bg-emerald-800 text-white p-6 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 -mr-16 -mt-16 rounded-full"></div>
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-tight">ENTREGAS<br/>SII PALLETS</h1>
            <div className="flex items-center gap-2 text-[9px] font-bold text-emerald-200 bg-emerald-900/40 px-3 py-1 rounded-full mt-2 w-fit border border-emerald-500/20">
              <Cloud size={10} className="animate-pulse" /> SINCRO NUBE OK
            </div>
          </div>
          <div className="flex gap-2">
            <button className="bg-emerald-700/50 p-3 rounded-2xl border border-white/10 active:scale-95 transition-all">
              <Bell size={20} />
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

        {/* DASHBOARD RÁPIDO */}
        <div className="mt-8 px-2 grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Pallets</p>
            <p className="text-3xl font-black text-emerald-700 leading-none mt-2">{totalPalletsDay}</p>
          </div>
          <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Entregas</p>
            <p className="text-3xl font-black text-indigo-700 leading-none mt-2">{filteredDayLoads.length}</p>
          </div>
        </div>

        {/* BUSCADOR */}
        <div className="px-2 mb-6">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <input 
              type="text" 
              placeholder="Buscar Cliente u OC..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border-2 border-slate-50 rounded-3xl py-4 pl-14 pr-6 shadow-sm text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none"
            />
          </div>
        </div>

        {/* LISTADO DE ENTREGAS */}
        <div className="space-y-4 px-2 pb-16">
          {filteredDayLoads.length > 0 ? (
            filteredDayLoads.map(load => (
              <div key={load.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${
                      load.status === 'Completado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {load.status}
                    </span>
                    <h4 className="font-black text-slate-900 text-lg uppercase mt-2 leading-tight">{load.customer}</h4>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingId(load.id); setNewLoad(load); setShowForm(true); }} className="p-2 text-slate-300 hover:text-emerald-600 transition-colors">
                      <Edit3 size={18} />
                    </button>
                    <button onClick={() => deleteLoad(load.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-500 mb-4 bg-slate-50 p-3 rounded-2xl">
                  <div className="flex items-center gap-2"><Hash size={14} className="text-emerald-500" /> OC: {load.poNumber || '-'}</div>
                  <div className="flex items-center gap-2"><ListOrdered size={14} className="text-amber-500" /> Turno: {load.turnNumber || '-'}</div>
                  <div className="flex items-center gap-2"><Package size={14} className="text-emerald-500" /> {load.pallets} Pallets</div>
                  <div className="flex items-center gap-2"><Clock size={14} className="text-slate-400" /> {load.time} HS</div>
                </div>

                {load.articles && load.articles.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                    {load.articles.map((art, i) => (
                      <span key={i} className="text-[10px] bg-slate-100 px-2 py-1 rounded-lg text-slate-600 font-bold border border-slate-200">
                        {art.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-16 bg-slate-200/20 rounded-[3rem] border-2 border-dashed border-slate-200">
              <p className="text-slate-300 font-black uppercase text-xs tracking-widest italic">Sin registros encontrados</p>
            </div>
          )}
        </div>
      </main>

      {/* BOTÓN AGREGAR */}
      <button 
        onClick={() => { setEditingId(null); setNewLoad(initialFormState); setShowForm(true); }}
        className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-emerald-800 text-white flex items-center gap-3 px-10 py-5 rounded-full shadow-2xl z-50 border-4 border-white active:scale-95 transition-all"
      >
        <Plus size={24} className="stroke-[4px]" />
        <span className="font-black text-sm uppercase tracking-tight">NUEVA CARGA</span>
      </button>

      {/* MODAL FORMULARIO */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/90 z-[60] flex items-end justify-center backdrop-blur-sm px-2 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-t-[3.5rem] shadow-2xl p-8 overflow-y-auto max-h-[96vh] animate-in slide-in-from-bottom duration-500">
            <div className="flex justify-between items-center mb-8 sticky top-0 bg-white py-2 z-10 border-b border-slate-50">
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase italic leading-none">{editingId ? 'Editar' : 'Nueva'} Carga</h2>
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">Gestión SII Pallets</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-4 bg-slate-100 rounded-[1.5rem] text-slate-400 active:scale-90 transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={saveLoad} className="space-y-6 pb-12">
              <div className="flex gap-2">
                {['Pendiente', 'En Proceso', 'Completado'].map(s => (
                  <button key={s} type="button" onClick={() => setNewLoad({...newLoad, status: s})}
                    className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase border-2 transition-all
                      ${newLoad.status === s ? 'bg-emerald-800 border-emerald-800 text-white' : 'bg-white text-slate-300 border-slate-50'}`}
                  >{s}</button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <input type="date" required value={newLoad.date} onChange={e => setNewLoad({...newLoad, date: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-5 text-sm font-black" />
                <input type="time" required value={newLoad.time} onChange={e => setNewLoad({...newLoad, time: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-5 text-sm font-black" />
              </div>

              <div className="space-y-4 bg-slate-50 p-6 rounded-[2.5rem]">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Cliente</label>
                  <input type="text" placeholder="Nombre Empresa" required value={newLoad.customer} onChange={e => setNewLoad({...newLoad, customer: e.target.value})} className="w-full bg-white border border-slate-200 rounded-2xl p-5 text-sm font-black uppercase" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Turno N°</label>
                    <input type="text" placeholder="00" required value={newLoad.turnNumber} onChange={e => setNewLoad({...newLoad, turnNumber: e.target.value})} className="bg-white border border-slate-200 rounded-2xl p-5 text-sm font-black text-emerald-600" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Orden Compra</label>
                    <input type="text" placeholder="OC-" value={newLoad.poNumber} onChange={e => setNewLoad({...newLoad, poNumber: e.target.value})} className="bg-white border border-slate-200 rounded-2xl p-5 text-sm font-black font-mono" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-emerald-600 uppercase ml-2">Total Pallets</label>
                  <input type="number" required value={newLoad.pallets} onChange={e => setNewLoad({...newLoad, pallets: e.target.value})} className="bg-emerald-50 border-none rounded-2xl p-5 text-sm font-black" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-emerald-600 uppercase ml-2">Transporte</label>
                  <input type="text" placeholder="Chofer/Empresa" value={newLoad.transport} onChange={e => setNewLoad({...newLoad, transport: e.target.value})} className="bg-emerald-50 border-none rounded-2xl p-5 text-sm font-black" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Condición del Equipo</label>
                <textarea rows="2" placeholder="Limpieza, estado de lona, precintos..." value={newLoad.condition} onChange={e => setNewLoad({...newLoad, condition: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-black"></textarea>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lista de Artículos</h3>
                  <button type="button" onClick={addArticleField} className="bg-emerald-600 text-white p-2 rounded-xl active:scale-90 transition-all">
                    <Plus size={18} className="stroke-[3px]" />
                  </button>
                </div>
                {newLoad.articles.map((art, index) => (
                  <div key={index} className="flex gap-2 items-center group">
                    <div className="flex-1 bg-white border border-slate-100 p-4 rounded-3xl shadow-sm">
                      <input type="text" placeholder="Producto" required value={art.name} onChange={e => updateArticle(index, 'name', e.target.value)} className="w-full border-none text-sm p-0 focus:ring-0 font-black uppercase" />
                      <input type="text" placeholder="Características (Peso, Lote...)" value={art.feature} onChange={e => updateArticle(index, 'feature', e.target.value)} className="w-full border-none text-[10px] p-0 mt-1 focus:ring-0 text-slate-400 italic" />
                    </div>
                    {newLoad.articles.length > 1 && (
                      <button type="button" onClick={() => removeArticle(index)} className="p-2 text-rose-300 hover:text-rose-500"><Trash2 size={20} /></button>
                    )}
                  </div>
                ))}
              </div>

              <button type="submit" className="w-full bg-emerald-800 text-white font-black py-6 rounded-[2.5rem] shadow-2xl uppercase tracking-widest text-sm flex items-center justify-center gap-3">
                <Save size={20} /> {editingId ? 'Actualizar' : 'Confirmar Registro'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
