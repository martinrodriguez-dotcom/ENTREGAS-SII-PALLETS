import React, { useState, useMemo, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  Plus, X, Package, Truck, Calendar as CalendarIcon, 
  ChevronLeft, ChevronRight, Clock, Hash, Trash2, 
  Edit3, Search, ListOrdered, Save, Cloud, 
  Share2, Copy, Check, Bell, BellRing, FilePlus, FileText, Printer, ArrowRight, AlertCircle, AlertTriangle, Eye, ListFilter, ClipboardList, Lock, LogOut, DollarSign, UserPlus, CreditCard
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
  // --- ESTADOS DE AUTENTICACIÓN ---
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('user'); 
  const [isLoginView, setIsLoginView] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // --- ESTADOS DE DATOS ---
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loads, setLoads] = useState([]);
  const [internalOCs, setInternalOCs] = useState([]);
  
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // --- ESTADOS DE UI ---
  const [showForm, setShowForm] = useState(false);
  const [showOCForm, setShowOCForm] = useState(false);
  const [showOCPicker, setShowOCPicker] = useState(false);
  const [ocSuccess, setOcSuccess] = useState(null);
  const [viewLoad, setViewLoad] = useState(null); 
  const [shareLoad, setShareLoad] = useState(null);
  const [quickStatusLoad, setQuickStatusLoad] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedInternalOCId, setSelectedInternalOCId] = useState(null); 
  const [searchQuery, setSearchQuery] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);

  const initialLoadState = {
    date: new Date().toISOString().split('T')[0],
    time: "08:00",
    turnNumber: "",
    customer: "",
    poNumber: "",
    pallets: "",
    transport: "",
    condition: "",
    paymentCondition: "",
    price: "",
    accountType: "Cta 1",
    status: "Pendiente",
    articles: [{ name: "", feature: "" }]
  };
  const [newLoad, setNewLoad] = useState(initialLoadState);

  const [newOC, setNewOC] = useState({
    customer: "",
    date: new Date().toISOString().split('T')[0],
    turn: "", 
    paymentCondition: "",
    price: "",
    accountType: "Cta 1",
    articles: [{ name: "", qty: "" }]
  });

  // --- LOGICA DE AUTH Y PERMISOS ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const docRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'info');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setUserRole(docSnap.data().role || 'user');
        } else {
          // Registro de nuevo perfil por defecto
          await setDoc(docRef, { 
            email: currentUser.email, 
            role: 'user', 
            createdAt: new Date().toISOString() 
          });
          setUserRole('user');
        }
        setUser(currentUser);
      } else {
        setUser(null);
        setUserRole('user');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (isLoginView) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      if (err.code === 'auth/weak-password') {
        setAuthError("La contraseña debe tener al menos 6 caracteres.");
      } else {
        setAuthError(isLoginView ? "Correo o clave incorrectos." : "Error al crear la cuenta.");
      }
    }
  };

  const handleLogout = () => signOut(auth);

  // --- SINCRONIZACIÓN FIRESTORE ---
  useEffect(() => {
    if (!user) return;
    const loadsRef = collection(db, 'artifacts', appId, 'public', 'data', 'loads');
    const ocsRef = collection(db, 'artifacts', appId, 'public', 'data', 'internal_ocs');

    const unsubLoads = onSnapshot(loadsRef, (snap) => {
      setLoads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => console.error("Error Cargas:", err));

    const unsubOCs = onSnapshot(ocsRef, (snap) => {
      setInternalOCs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Error OCs:", err));

    return () => { unsubLoads(); unsubOCs(); };
  }, [user]);

  const isAdmin = useMemo(() => userRole === 'admin', [userRole]);

  // --- LÓGICA DE ALERTAS (PRÓXIMAS Y FLETES) ---
  const internalAlerts = useMemo(() => {
    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limitDate = new Date(today);
    limitDate.setDate(today.getDate() + 5);

    loads.forEach(load => {
      const loadDate = new Date(load.date);
      // Alerta Flete
      if (!load.transport || load.transport.trim() === "") {
        alerts.push({ id: `flete-${load.id}`, type: 'missing_data', title: 'Falta Flete', message: `Carga para ${load.customer}`, loadId: load.id });
      }
      // Alerta Próxima
      if (loadDate >= today && loadDate <= limitDate && load.status !== 'Entregado') {
        alerts.push({ id: `prox-${load.id}`, type: 'proximity', title: 'Entrega Próxima', message: `${load.customer} - ${load.date}`, loadId: load.id });
      }
    });
    return alerts;
  }, [loads]);

  const nextOCNumber = useMemo(() => {
    if (internalOCs.length === 0) return "0001";
    const nums = internalOCs.map(o => parseInt(o.ocNumber)).filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return (max + 1).toString().padStart(4, '0');
  }, [internalOCs]);

  const availableOCs = useMemo(() => {
    return internalOCs.filter(oc => oc.isUsed !== true).sort((a, b) => b.ocNumber.localeCompare(a.ocNumber));
  }, [internalOCs]);

  // Autocompletado desde OC Interna
  const selectOC = (oc) => {
    const totalPalletsSuma = oc.articles.reduce((sum, art) => sum + (Number(art.qty) || 0), 0);
    setNewLoad({
      ...initialLoadState,
      customer: oc.customer,
      poNumber: oc.ocNumber,
      date: oc.date,
      paymentCondition: oc.paymentCondition || "",
      price: oc.price || "",
      accountType: oc.accountType || "Cta 1",
      pallets: totalPalletsSuma > 0 ? totalPalletsSuma.toString() : "",
      articles: oc.articles.map(a => ({ name: a.name, feature: a.qty }))
    });
    setSelectedInternalOCId(oc.id);
    setShowOCPicker(false);
  };

  const handleSaveLoad = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const id = editingId || Date.now().toString();
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'loads', id);
    try {
      await setDoc(docRef, { ...newLoad, id, updatedAt: new Date().toISOString() });
      if (selectedInternalOCId) {
        const ocRef = doc(db, 'artifacts', appId, 'public', 'data', 'internal_ocs', selectedInternalOCId);
        await updateDoc(ocRef, { isUsed: true });
      }
      setShowForm(false);
      setEditingId(null);
      setSelectedInternalOCId(null);
      setNewLoad(initialLoadState);
    } catch (err) { console.error(err); }
  };

  const handleGenerateOC = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const ocNumber = nextOCNumber;
    const id = Date.now().toString();
    const ocData = { ...newOC, id, ocNumber, isUsed: false, createdAt: new Date().toISOString() };
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'internal_ocs', id), ocData);
      setOcSuccess(ocData);
      setShowOCForm(false);
      setNewOC({ customer: "", date: new Date().toISOString().split('T')[0], turn: "", paymentCondition: "", price: "", accountType: "Cta 1", articles: [{ name: "", qty: "" }] });
    } catch (err) { console.error(err); }
  };

  const updateQuickStatus = async (id, newStatus) => {
    if (!isAdmin) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loads', id), { status: newStatus });
    setQuickStatusLoad(null);
  };

  const deleteLoad = async (id) => {
    if (!isAdmin) return;
    if (window.confirm("¿Seguro que deseas eliminar este registro?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loads', id));
    }
  };

  const formatWhatsAppMessage = (load) => {
    if (!load) return "";
    let msg = `*📦 REPORTE DE ENTREGA - SII PALLETS*\n👤 *Cliente:* ${load.customer.toUpperCase()}\n📅 *Fecha:* ${load.date}\n⏰ *Hora:* ${load.time}hs\n📄 *OC:* ${load.poNumber || 'N/A'}\n🚚 *Transporte:* ${load.transport || 'S/D'}\n📦 *Pallets:* ${load.pallets}\n✅ *Estado:* ${load.status.toUpperCase()}`;
    if (isAdmin) {
      msg += `\n\n*ADMIN:* \n💰 *Precio:* $${load.price || '0'}\n💳 *Pago:* ${load.paymentCondition || 'S/D'}\n🏢 *Cuenta:* ${load.accountType}`;
    }
    return msg;
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

  // --- VISTA DE ACCESO ---
  if (authLoading) return <div className="h-screen flex items-center justify-center bg-emerald-900 text-white font-black italic animate-pulse">SII PALLETS v3.3...</div>;

  if (!user) {
    return (
      <div className="h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl p-10 flex flex-col items-center">
          <div className="bg-emerald-800 p-6 rounded-full text-white mb-8 shadow-xl">
             {isLoginView ? <Lock size={40} /> : <UserPlus size={40} />}
          </div>
          <h1 className="text-2xl font-black text-slate-800 uppercase italic">SII PALLETS</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10 text-center">
            {isLoginView ? 'Ingreso de Personal' : 'Registro de Colaborador'}
          </p>
          <form onSubmit={handleAuth} className="w-full space-y-4">
             <input type="email" placeholder="EMAIL" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl p-5 text-xs font-black uppercase shadow-inner outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all" />
             <input type="password" placeholder="PASSWORD" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl p-5 text-xs font-black uppercase shadow-inner outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all" />
             {authError && <p className="text-[9px] font-black text-rose-500 text-center uppercase">{authError}</p>}
             <button type="submit" className="w-full bg-emerald-800 text-white py-5 rounded-[2rem] font-black uppercase text-sm shadow-xl active:scale-95 transition-all">{isLoginView ? 'INGRESAR' : 'REGISTRARME'}</button>
          </form>
          <button onClick={() => setIsLoginView(!isLoginView)} className="mt-6 text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:underline">{isLoginView ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Ingresa'}</button>
        </div>
      </div>
    );
  }

  // --- VISTA DASHBOARD ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-24 overflow-x-hidden antialiased">
      
      {/* HEADER */}
      <header className="bg-emerald-800 text-white p-6 rounded-b-[2.5rem] shadow-xl relative flex-shrink-0">
        <div className="flex justify-between items-start relative z-10">
          <div>
            <h1 className="text-2xl font-black uppercase italic text-white leading-none">SII PALLETS</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[9px] font-bold bg-emerald-900/40 px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest text-emerald-200">
                {userRole === 'admin' ? 'ADMINISTRADOR' : 'LOGÍSTICA'}
              </span>
              <button onClick={handleLogout} className="p-1 text-emerald-400 hover:text-white transition-colors"><LogOut size={16}/></button>
            </div>
          </div>
          <button onClick={() => setShowAlerts(true)} className="p-3 bg-white/10 rounded-2xl relative active:scale-90 transition-all text-white">
            {internalAlerts.length > 0 ? <BellRing size={22} className="text-amber-400" /> : <Bell size={22} />}
            {internalAlerts.length > 0 && <span className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 text-[10px] font-black rounded-full flex items-center justify-center border-2 border-emerald-800 animate-bounce">{internalAlerts.length}</span>}
          </button>
        </div>

        <div className="mt-6 flex justify-between items-center bg-white/10 p-2 rounded-2xl border border-white/5">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 text-white"><ChevronLeft size={20} /></button>
          <h2 className="text-xs font-black uppercase tracking-widest text-white">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 text-white"><ChevronRight size={20} /></button>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="px-5 -mt-6 relative z-20">
        
        {/* CALENDARIO */}
        <div className="bg-white rounded-[2.5rem] shadow-xl p-6 border border-slate-100 mb-8">
          <div className="grid grid-cols-7 gap-1 text-center mb-4 text-[9px] font-black text-slate-300 uppercase">
            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => <div key={`cal-h-${i}`}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((date, idx) => {
              const dStr = date ? date.toISOString().split('T')[0] : `empty-${idx}`;
              const isSelected = date && dStr === selectedDate.toISOString().split('T')[0];
              const hasEvents = date && loads.some(l => l.date === dStr);
              return (
                <button key={`cb-${dStr}-${idx}`} disabled={!date} onClick={() => setSelectedDate(date)}
                  className={`h-10 rounded-2xl flex flex-col items-center justify-center relative transition-all
                    ${!date ? 'opacity-0' : 'opacity-100'}
                    ${isSelected ? 'bg-emerald-600 text-white shadow-lg scale-105 z-10' : 'bg-slate-50 text-slate-400 active:scale-95'}
                  `}
                >
                  <span className="text-xs font-black">{date?.getDate()}</span>
                  {hasEvents && !isSelected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-0.5"></div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ACCIONES (ADMIN) */}
        {isAdmin && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button onClick={() => { setEditingId(null); setNewLoad(initialLoadState); setShowForm(true); }} className="bg-emerald-800 text-white p-5 rounded-[2rem] shadow-lg flex flex-col items-center gap-2 active:scale-95 transition-all"><Plus size={24} /><span className="text-[10px] font-black uppercase tracking-widest">Nueva Carga</span></button>
            <button onClick={() => setShowOCForm(true)} className="bg-indigo-700 text-white p-5 rounded-[2rem] shadow-lg flex flex-col items-center gap-2 active:scale-95 transition-all"><FilePlus size={24} /><span className="text-[10px] font-black uppercase tracking-widest">Generar OC</span></button>
          </div>
        )}

        {/* BUSCADOR */}
        <div className="relative mb-8">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input type="text" placeholder="Buscar Cliente..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-slate-50 rounded-3xl py-4 pl-14 pr-6 text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all" />
        </div>

        {/* LISTADO DE ENTREGAS */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-4 flex items-center gap-2 mb-2 italic"><ClipboardList size={14}/> Hoja de Ruta - {selectedDate.toLocaleDateString()}</h3>
          {filteredDayLoads.length > 0 ? filteredDayLoads.map(load => {
            const needsFlete = !load.transport || load.transport.trim() === "";
            return (
              <div key={load.id} onClick={() => setViewLoad(load)}
                className={`bg-white p-6 rounded-[2.5rem] shadow-sm border relative transition-all duration-300 active:scale-[0.98]
                ${needsFlete ? 'border-rose-200 ring-4 ring-rose-50 animate-[pulse_3s_infinite]' : 'border-slate-100 hover:border-emerald-100'}`}>
                <div className="flex justify-between items-start mb-4">
                   <div className="flex-1">
                     <button onClick={(e) => { e.stopPropagation(); if(isAdmin) setQuickStatusLoad(load); }}
                      className={`text-[8px] font-black uppercase px-2 py-1 rounded-full shadow-sm transition-all ${
                        load.status === 'Entregado' ? 'bg-emerald-100 text-emerald-700' : 
                        load.status === 'En Proceso' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                      }`}>{load.status}</button>
                     <h4 className="font-black text-slate-900 text-lg uppercase mt-2 leading-tight flex items-center gap-2">{load.customer} <Eye size={14} className="text-slate-200" /></h4>
                   </div>
                   {isAdmin && (
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEditingId(load.id); setNewLoad(load); setShowForm(true); }} className="p-2 text-slate-200 hover:text-blue-500 active:scale-110 transition-all"><Edit3 size={18} /></button>
                        <button onClick={() => deleteLoad(load.id)} className="p-2 text-slate-200 hover:text-rose-500 active:scale-110 transition-all"><Trash2 size={18} /></button>
                    </div>
                   )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-slate-400 mb-4 bg-slate-50/50 p-3 rounded-2xl">
                  <div className="flex items-center gap-1"><Clock size={12} className="text-slate-300" /> {load.time} HS</div>
                  <div className="flex items-center gap-1"><Package size={12} className="text-emerald-500" /> {load.pallets} PLTS</div>
                  <div className="flex items-center gap-1 truncate"><Hash size={12} className="text-slate-300" /> OC: {load.poNumber || 'S/N'}</div>
                </div>

                {/* DETALLE PRODUCTOS */}
                {load.articles && load.articles.length > 0 && load.articles[0].name && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-50 pt-3 mt-1">
                    {load.articles.map((art, i) => (
                      <div key={`${load.id}-art-${i}`} className="bg-slate-100/50 px-2 py-1 rounded-lg border border-slate-200/20">
                         <span className="text-[9px] font-black uppercase text-slate-600">{art.name}</span>
                         <span className="text-[8px] font-bold text-slate-400 ml-1">({art.feature})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="text-center py-20 bg-slate-200/10 rounded-[4rem] border-2 border-dashed border-slate-200 flex flex-col items-center">
              <Package size={40} className="text-slate-200 mb-4" />
              <p className="text-slate-300 font-black uppercase text-[10px] italic tracking-widest">Sin entregas para hoy</p>
            </div>
          )}
        </div>
      </main>

      {/* --- MODALES --- */}

      {/* MODAL: SELECTOR OC PENDIENTES */}
      {showOCPicker && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/80 z-[250] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-indigo-50">
              <h2 className="text-xl font-black text-indigo-900 uppercase italic">OC Pendientes</h2>
              <button onClick={() => setShowOCPicker(false)} className="p-3 bg-white rounded-2xl text-slate-400 active:scale-90 transition-all"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto hide-scrollbar">
              {availableOCs.length > 0 ? availableOCs.map((oc) => (
                <div key={`p-oc-${oc.id}`} onClick={() => selectOC(oc)}
                  className="bg-white border-2 border-slate-50 p-5 rounded-[2rem] flex items-center justify-between cursor-pointer hover:border-indigo-500 active:scale-[0.98] transition-all">
                  <div className="flex items-center gap-5">
                    <FileText size={24} className="text-indigo-600" />
                    <div>
                      <p className="text-xs font-black uppercase text-slate-900 leading-tight">{oc.customer}</p>
                      <p className="text-[10px] font-bold text-indigo-500 uppercase">OC #{oc.ocNumber}</p>
                    </div>
                  </div>
                  <ArrowRight size={20} className="text-slate-200" />
                </div>
              )) : <div className="text-center py-10"><p className="text-xs font-black text-slate-300 uppercase tracking-widest italic">No hay OCs pendientes</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA OC (ADMIN) */}
      {showOCForm && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] flex items-end justify-center p-0 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[3.5rem] shadow-2xl p-8 overflow-y-auto max-h-[95vh] animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-black text-slate-800 uppercase italic">Generar OC Interna</h2>
              <button onClick={() => setShowOCForm(false)} className="p-3 bg-slate-100 rounded-2xl active:scale-90 transition-all"><X size={20} /></button>
            </div>
            <form onSubmit={handleGenerateOC} className="space-y-6">
              <input type="text" required placeholder="NOMBRE DEL CLIENTE" value={newOC.customer} onChange={e => setNewOC({...newOC, customer: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-black uppercase shadow-inner" />
              
              <div className="bg-emerald-50 p-6 rounded-[2.5rem] space-y-4 border border-emerald-100">
                <p className="text-[9px] font-black text-emerald-800 uppercase flex items-center gap-2 italic"><DollarSign size={14}/> Administración / Precios</p>
                <div className="grid grid-cols-2 gap-4">
                   <input type="text" placeholder="COND. PAGO" value={newOC.paymentCondition} onChange={e => setNewOC({...newOC, paymentCondition: e.target.value})} className="bg-white rounded-xl p-4 text-xs font-black shadow-sm" />
                   <input type="number" placeholder="PRECIO $" value={newOC.price} onChange={e => setNewOC({...newOC, price: e.target.value})} className="bg-white rounded-xl p-4 text-xs font-black shadow-sm" />
                </div>
                <div className="flex gap-2">
                  {['Cta 1', 'Cta 2'].map(cta => (
                    <button key={`oc-cta-${cta}`} type="button" onClick={() => setNewOC({...newOC, accountType: cta})} 
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all 
                      ${newOC.accountType === cta ? 'bg-emerald-800 border-emerald-800 text-white shadow-md' : 'bg-white text-emerald-300 border-emerald-100'}`}>{cta}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <input type="date" required value={newOC.date} onChange={e => setNewOC({...newOC, date: e.target.value})} className="bg-slate-50 rounded-2xl p-5 text-sm font-black shadow-inner" />
                 <input type="text" placeholder="TURNO / REF" value={newOC.turn} onChange={e => setNewOC({...newOC, turn: e.target.value})} className="bg-slate-50 rounded-2xl p-5 text-sm font-black uppercase shadow-inner" />
              </div>
              
              <div className="space-y-4">
                 <div className="flex justify-between items-center px-2">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Artículos Detallados</h3>
                   <button type="button" onClick={() => setNewOC({...newOC, articles: [...newOC.articles, {name:"", qty:""}]})} className="bg-indigo-600 text-white p-2 rounded-xl active:scale-90 shadow-md transition-all"><Plus size={18} /></button>
                 </div>
                 {newOC.articles.map((art, idx) => (
                    <div key={`onr-${idx}`} className="flex gap-2 animate-in slide-in-from-left-2">
                       <input type="text" placeholder="Producto" required value={art.name} onChange={e => { const u = [...newOC.articles]; u[idx].name = e.target.value; setNewOC({...newOC, articles: u}); }} className="flex-1 bg-slate-50 border-none rounded-2xl p-4 text-xs font-black uppercase shadow-inner" />
                       <input type="text" placeholder="Cant." required value={art.qty} onChange={e => { const u = [...newOC.articles]; u[idx].qty = e.target.value; setNewOC({...newOC, articles: u}); }} className="w-24 bg-slate-50 border-none rounded-2xl p-4 text-xs font-black uppercase text-center shadow-inner" />
                    </div>
                 ))}
              </div>
              <button type="submit" className="w-full bg-indigo-700 text-white font-black py-6 rounded-[2.5rem] shadow-2xl uppercase tracking-widest text-sm active:scale-95 transition-all flex items-center justify-center gap-3"><FileText size={20} /> GENERAR OC</button>
            </form>
          </div>
        </div>
      )}

      {/* OC SUCCESS */}
      {ocSuccess && (
        <div className="fixed inset-0 bg-slate-900/95 z-[300] flex items-center justify-center p-6 backdrop-blur-md animate-in zoom-in-95">
          <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl p-10 flex flex-col items-center text-center">
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

      {/* MODAL: FORMULARIO ENTREGA (ADMIN) */}
      {showForm && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] flex items-end justify-center backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[3.5rem] shadow-2xl p-8 overflow-y-auto max-h-[92%] animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">{editingId ? 'Editar' : 'Nueva'} Entrega</h2>
              <button onClick={() => { setShowForm(false); setSelectedInternalOCId(null); }} className="p-4 bg-slate-100 rounded-[1.5rem] text-slate-400 active:scale-90 transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveLoad} className="space-y-6">
              <div className="flex gap-2">
                {['Pendiente', 'En Proceso', 'Entregado'].map(s => (
                  <button key={`status-btn-form-${s}`} type="button" onClick={() => setNewLoad({...newLoad, status: s})} 
                    className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all 
                    ${newLoad.status === s ? 'bg-emerald-800 border-emerald-800 text-white shadow-xl shadow-emerald-100' : 'bg-white text-slate-300 border-slate-100 hover:border-slate-200 transition-all'}`}>{s}</button>
                ))}
              </div>

              <input type="text" required placeholder="NOMBRE DEL CLIENTE" value={newLoad.customer} onChange={e => setNewLoad({...newLoad, customer: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-5 text-sm font-black uppercase shadow-inner" />
              
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="TURNO N°" value={newLoad.turnNumber} onChange={e => setNewLoad({...newLoad, turnNumber: e.target.value})} className="bg-slate-50 rounded-2xl p-5 text-sm font-black text-emerald-600 shadow-inner" />
                <div className="relative">
                   <input type="text" placeholder="OC-" value={newLoad.poNumber} onChange={e => setNewLoad({...newLoad, poNumber: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-5 text-sm font-black uppercase pr-12 shadow-inner" />
                   {!editingId && <button type="button" onClick={() => setShowOCPicker(true)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl active:scale-90 transition-all shadow-md"><ListFilter size={18} /></button>}
                </div>
              </div>

              <div className="bg-emerald-50 p-6 rounded-[2.5rem] space-y-4 border border-emerald-100 shadow-inner">
                <p className="text-[9px] font-black text-emerald-800 uppercase flex items-center gap-2 italic"><DollarSign size={14}/> Datos Administración</p>
                <div className="grid grid-cols-2 gap-4">
                   <input type="text" placeholder="COND. PAGO" value={newLoad.paymentCondition} onChange={e => setNewLoad({...newLoad, paymentCondition: e.target.value})} className="bg-white rounded-xl p-4 text-xs font-black shadow-sm" />
                   <input type="number" placeholder="PRECIO $" value={newLoad.price} onChange={e => setNewLoad({...newLoad, price: e.target.value})} className="bg-white rounded-xl p-4 text-xs font-black shadow-sm" />
                </div>
                <div className="flex gap-2">
                  {['Cta 1', 'Cta 2'].map(cta => (
                    <button key={`load-cta-${cta}`} type="button" onClick={() => setNewLoad({...newLoad, accountType: cta})} 
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all 
                      ${newLoad.accountType === cta ? 'bg-emerald-800 border-emerald-800 text-white shadow-md' : 'bg-white text-emerald-300 border-emerald-100'}`}>{cta}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="PALLETS" required value={newLoad.pallets} onChange={e => setNewLoad({...newLoad, pallets: e.target.value})} className="bg-slate-50 rounded-2xl p-5 text-sm font-black shadow-inner" />
                <input type="text" placeholder="FLETE" value={newLoad.transport} onChange={e => setNewLoad({...newLoad, transport: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-5 text-sm font-black shadow-inner" />
              </div>

              <div className="space-y-4">
                 <div className="flex justify-between items-center px-2">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Detalle de Productos</h3>
                   <button type="button" onClick={() => setNewLoad(p => ({...p, articles: [...p.articles, {name:"", feature:""}]}))} className="bg-emerald-700 text-white p-2 rounded-xl active:scale-90"><Plus size={16} /></button>
                 </div>
                 {newLoad.articles.map((art, idx) => (
                    <div key={`edit-art-line-${idx}`} className="flex gap-2">
                       <input type="text" placeholder="Producto" required value={art.name} onChange={e => { const u = [...newLoad.articles]; u[idx].name = e.target.value; setNewLoad({...newLoad, articles: u}); }} className="flex-1 bg-slate-50 border-none rounded-2xl p-4 text-[11px] font-black uppercase shadow-inner" />
                       <input type="text" placeholder="Cant." value={art.feature} onChange={e => { const u = [...newLoad.articles]; u[idx].feature = e.target.value; setNewLoad({...newLoad, articles: u}); }} className="w-24 bg-slate-50 border-none rounded-2xl p-4 text-[11px] font-black uppercase text-center shadow-inner" />
                    </div>
                 ))}
              </div>

              <button type="submit" className="w-full bg-emerald-800 text-white font-black py-6 rounded-[2.5rem] shadow-2xl uppercase tracking-widest text-sm active:scale-95 transition-all flex items-center justify-center gap-3"><Save size={20} /> GUARDAR REGISTRO</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLE (VISTA COMPLETA) */}
      {viewLoad && (
        <div className="fixed inset-0 bg-slate-900/95 z-[140] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-emerald-800 text-white flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black uppercase italic leading-tight tracking-tighter text-white">{viewLoad.customer}</h2>
                <p className="text-emerald-200 text-[10px] font-bold mt-2 uppercase tracking-widest">{viewLoad.date} • {viewLoad.time} HS</p>
              </div>
              <button onClick={() => setViewLoad(null)} className="p-3 bg-white/10 rounded-2xl active:scale-90 transition-all text-white"><X size={20}/></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto max-h-[60vh] hide-scrollbar bg-white">
              {isAdmin && (
                <div className="bg-emerald-50 p-6 rounded-[2.5rem] border-2 border-emerald-100 space-y-3 animate-in fade-in zoom-in-95">
                  <p className="text-[10px] font-black text-emerald-800 uppercase flex items-center gap-2 italic"><DollarSign size={12}/> Datos Financieros</p>
                  <div className="flex justify-between items-center text-sm font-black">
                     <span className="text-emerald-900 text-xl font-black italic">$ {viewLoad.price || '0'}</span>
                     <span className="bg-emerald-800 text-white px-4 py-1.5 rounded-xl text-[10px] shadow-sm">{viewLoad.accountType}</span>
                  </div>
                  <p className="text-xs font-bold text-emerald-600 uppercase border-t border-emerald-100 pt-3 flex items-center gap-2"><CreditCard size={14}/> Condición: {viewLoad.paymentCondition || 'S/D'}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 text-center shadow-inner">
                   <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Referencia OC</p>
                   <p className="text-sm font-black">{viewLoad.poNumber || 'S/N'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 text-center shadow-inner">
                   <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Turno</p>
                   <p className="text-sm font-black text-emerald-600">#{viewLoad.turnNumber || '-'}</p>
                </div>
              </div>

              <div className={`p-6 rounded-[2.5rem] border-2 transition-colors ${(!viewLoad.transport || viewLoad.transport.trim() === "") ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center gap-2 italic tracking-widest"><Truck size={14}/> Logística</p>
                <p className={`text-sm font-black ${(!viewLoad.transport || viewLoad.transport.trim() === "") ? 'text-rose-600' : 'text-slate-900'}`}>
                  {viewLoad.transport || '⚠️ FLETE PENDIENTE'}
                </p>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200/50">
                  <Package size={18} className="text-emerald-500"/>
                  <p className="text-xl font-black text-emerald-900 tracking-tighter">{viewLoad.pallets} Pallets Totales</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest italic flex items-center gap-2"><ListFilter size={12}/> Productos Cargados</p>
                <div className="space-y-2">
                   {viewLoad.articles?.map((art, i) => (
                      <div key={`view-art-line-${i}`} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex justify-between items-center hover:bg-slate-50 transition-all">
                         <span className="text-xs font-black uppercase text-slate-800">{art.name}</span>
                         <span className="text-[10px] font-bold text-slate-400 italic bg-slate-50 px-3 py-1 rounded-lg">Cant: {art.feature}</span>
                      </div>
                   ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t flex gap-3 shadow-inner">
               {isAdmin && <button onClick={() => {setEditingId(viewLoad.id); setNewLoad(viewLoad); setShowForm(true); setViewLoad(null);}} className="flex-1 py-5 bg-white border-2 border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-400 active:scale-95 transition-all">Editar</button>}
               <button onClick={() => {setShareLoad(viewLoad); setViewLoad(null);}} className="flex-1 py-5 bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"><Share2 size={16}/> Reporte</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ALERTAS DE SISTEMA (CORREGIDO) */}
      {showAlerts && (
        <div className="fixed inset-0 bg-slate-900/90 z-[160] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-emerald-50">
              <h2 className="text-xl font-black text-emerald-900 uppercase italic">Notificaciones</h2>
              <button onClick={() => setShowAlerts(false)} className="p-4 bg-white rounded-2xl active:scale-90 transition-all"><X size={20} /></button>
            </div>
            <div className="p-8 overflow-y-auto max-h-[60vh] hide-scrollbar text-center">
              {internalAlerts.length > 0 ? internalAlerts.map((a, i) => (
                <div key={`alert-i-${i}`} className={`p-5 rounded-3xl border-2 flex items-center gap-4 mb-3 text-left shadow-sm ${a.type === 'proximity' ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100'}`}>
                  {a.type === 'proximity' ? <CalendarIcon size={24} className="text-amber-600 shrink-0" /> : <AlertTriangle size={24} className="text-rose-600 shrink-0" />}
                  <div>
                    <p className={`text-[10px] font-black uppercase ${a.type === 'proximity' ? 'text-amber-900' : 'text-rose-900'}`}>{a.title}</p>
                    <p className={`text-xs font-bold ${a.type === 'proximity' ? 'text-amber-500' : 'text-rose-500'}`}>{a.message}</p>
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

      {/* MODAL REPORTE WHATSAPP */}
      {shareLoad && (
        <div className="fixed inset-0 bg-slate-900/90 z-[210] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-800 uppercase italic flex items-center gap-4 tracking-tighter"><Share2 size={24} className="text-emerald-700" /> Reporte</h2>
              <button onClick={() => setShareLoad(null)} className="p-3 bg-slate-100 rounded-full text-slate-300 active:scale-90 transition-all"><X size={20} /></button>
            </div>
            <div className="flex-1 bg-slate-50 rounded-[2.5rem] p-8 overflow-y-auto mb-10 border-2 border-slate-100 shadow-inner">
              <pre className="text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">{formatWhatsAppMessage(shareLoad)}</pre>
            </div>
            <button onClick={() => copyToClipboard(formatWhatsAppMessage(shareLoad))}
              className={`w-full py-7 rounded-[2.5rem] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-4 transition-all shadow-xl ${copyFeedback ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-200' : 'bg-emerald-800 text-white active:scale-95'}`}>
              {copyFeedback ? '¡MENSAJE COPIADO!' : 'COPIAR PARA WHATSAPP'}
            </button>
          </div>
        </div>
      )}

      {/* SELECTOR ESTADO RÁPIDO */}
      {quickStatusLoad && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 z-[150] flex items-center justify-center p-12 backdrop-blur-sm animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-xs rounded-[3rem] shadow-2xl p-8 animate-in zoom-in-95">
            <h3 className="text-center font-black text-slate-400 text-[10px] uppercase mb-8 tracking-widest italic leading-relaxed">Actualizar Proceso</h3>
            <div className="space-y-4">
              {['Pendiente', 'En Proceso', 'Entregado'].map(s => (
                <button key={`quick-st-${s}`} onClick={() => updateQuickStatus(quickStatusLoad.id, s)}
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

    </div>
  );
};

export default App;

