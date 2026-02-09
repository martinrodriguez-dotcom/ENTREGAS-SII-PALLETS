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
  Share2, Copy, Check, Bell, BellRing, FilePlus, FileText, Printer, ArrowRight, AlertCircle, AlertTriangle, Eye, ListFilter, ClipboardList, Lock, LogOut, DollarSign, UserPlus, CreditCard, History, User, Car
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
  // --- 1. ESTADOS DE AUTENTICACIÓN ---
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('user'); 
  const [isLoginView, setIsLoginView] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // --- 2. ESTADOS DE DATOS ---
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loads, setLoads] = useState([]);
  const [internalOCs, setInternalOCs] = useState([]);
  
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // --- 3. ESTADOS DE UI ---
  const [showForm, setShowForm] = useState(false);
  const [showOCForm, setShowOCForm] = useState(false);
  const [showOCHistory, setShowOCHistory] = useState(false);
  const [showOCPicker, setShowOCPicker] = useState(false);
  const [ocSuccess, setOcSuccess] = useState(null);
  const [viewLoad, setViewLoad] = useState(null); 
  const [shareLoad, setShareLoad] = useState(null);
  const [quickStatusLoad, setQuickStatusLoad] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedInternalOCId, setSelectedInternalOCId] = useState(null); 
  const [searchQuery, setSearchQuery] = useState("");
  const [ocSearchQuery, setOcSearchQuery] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [notifPermission, setNotifPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');

  const initialLoadState = {
    date: new Date().toISOString().split('T')[0],
    time: "08:00",
    turnNumber: "",
    customer: "",
    poNumber: "",
    pallets: "",
    transportName: "",    // Subcampo: Empresa
    transportDriver: "",  // Subcampo: Chofer
    transportVehicle: "", // Subcampo: Vehiculo
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
    transportName: "",
    transportDriver: "",
    transportVehicle: "",
    articles: [{ name: "", qty: "" }]
  });

  // --- LÓGICA DE AUTENTICACIÓN ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const docRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'info');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserRole(docSnap.data().role || 'user');
        } else {
          await setDoc(docRef, { email: currentUser.email, role: 'user', createdAt: new Date().toISOString() });
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
      setAuthError(isLoginView ? "Credenciales incorrectas." : "Error: mínimo 6 caracteres.");
    }
  };

  const handleLogout = () => signOut(auth);

  const requestNotifPermission = async () => {
    if (typeof Notification !== 'undefined') {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
    }
  };

  // --- SINCRONIZACIÓN FIRESTORE ---
  useEffect(() => {
    if (!user) return;
    const loadsRef = collection(db, 'artifacts', appId, 'public', 'data', 'loads');
    const ocsRef = collection(db, 'artifacts', appId, 'public', 'data', 'internal_ocs');

    const unsubLoads = onSnapshot(loadsRef, (snap) => {
      setLoads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const unsubOCs = onSnapshot(ocsRef, (snap) => {
      setInternalOCs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubLoads(); unsubOCs(); };
  }, [user]);

  // --- MEMOS DE NEGOCIO ---
  const isAdmin = useMemo(() => userRole === 'admin', [userRole]);

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

  const internalAlerts = useMemo(() => {
    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limitDate = new Date(today);
    limitDate.setDate(today.getDate() + 5);

    loads.forEach(load => {
      const loadDate = new Date(load.date);
      // Alerta Flete
      if (!load.transportName || load.transportName.trim() === "") {
        alerts.push({ id: `flete-${load.id}`, type: 'missing_data', title: 'Falta Flete', message: load.customer, loadId: load.id });
      }
      // Alerta Próxima Entrega
      if (loadDate >= today && loadDate <= limitDate && load.status !== 'Entregado') {
        alerts.push({ id: `prox-${load.id}`, type: 'proximity', title: 'Entrega Próxima', message: `${load.customer} (${load.date})`, loadId: load.id });
      }
    });
    return alerts;
  }, [loads]);

  const availableOCs = useMemo(() => {
    return internalOCs.filter(oc => oc.isUsed !== true).sort((a, b) => b.ocNumber.localeCompare(a.ocNumber));
  }, [internalOCs]);

  const filteredDayLoads = useMemo(() => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    return loads.filter(l => l.date === dateStr && (l.customer.toLowerCase().includes(searchQuery.toLowerCase()) || (l.poNumber && l.poNumber.toLowerCase().includes(searchQuery.toLowerCase()))));
  }, [loads, selectedDate, searchQuery]);

  const filteredOCHistory = useMemo(() => {
    return internalOCs.filter(oc => 
      oc.customer.toLowerCase().includes(ocSearchQuery.toLowerCase()) || 
      oc.ocNumber.includes(ocSearchQuery)
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [internalOCs, ocSearchQuery]);

  const nextOCNumber = useMemo(() => {
    if (internalOCs.length === 0) return "0001";
    const nums = internalOCs.map(o => parseInt(o.ocNumber)).filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return (max + 1).toString().padStart(4, '0');
  }, [internalOCs]);

  // --- MANEJADORES DE ACCIÓN ---
  const selectOC = (oc) => {
    const totalQty = oc.articles.reduce((sum, art) => sum + (Number(art.qty) || 0), 0);
    setNewLoad({
      ...initialLoadState,
      customer: oc.customer,
      poNumber: oc.ocNumber,
      date: oc.date,
      paymentCondition: oc.paymentCondition || "",
      price: oc.price || "",
      accountType: oc.accountType || "Cta 1",
      transportName: oc.transportName || "",
      transportDriver: oc.transportDriver || "",
      transportVehicle: oc.transportVehicle || "",
      pallets: totalQty > 0 ? totalQty.toString() : "",
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
      setNewOC({ customer: "", date: new Date().toISOString().split('T')[0], turn: "", paymentCondition: "", price: "", accountType: "Cta 1", transportName: "", transportDriver: "", transportVehicle: "", articles: [{ name: "", qty: "" }] });
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

  // --- REPORTES ---
  const printOC = (oc) => {
    const printWindow = window.open('', '_blank');
    const content = `<html><head><title>OC ${oc.ocNumber}</title><style>body{font-family:sans-serif;padding:40px;color:#333;}.header{text-align:center;border-bottom:2px solid #065f46;padding-bottom:20px;}.details{margin-top:30px;display:grid;grid-template-cols:1fr 1fr;gap:20px;}.table{width:100%;border-collapse:collapse;margin-top:20px;}.table th,.table td{border:1px solid #ddd;padding:12px;text-align:left;}.table th{background:#f4f4f4;}.footer{margin-top:50px;font-size:11px;text-align:center;color:#94a3b8;}.f-box{background:#f1f5f9;padding:15px;border-radius:10px;margin-bottom:20px; border: 1px solid #e2e8f0;}</style></head><body><div class="header"><h1>ORDEN DE COMPRA INTERNA</h1><p>SII PALLETS LOGÍSTICA</p></div><div class="details"><div><p><strong>N° OC:</strong> #${oc.ocNumber}</p><p><strong>Cliente:</strong> ${oc.customer.toUpperCase()}</p></div><div style="text-align:right;"><p><strong>Fecha:</strong> ${oc.date}</p><p><strong>Turno/Ref:</strong> ${oc.turn || 'N/A'}</p></div></div><div class="f-box"><p><strong>Transporte:</strong> ${oc.transportName || 'S/D'}</p><p><strong>Chofer:</strong> ${oc.transportDriver || 'S/D'}</p><p><strong>Vehículo:</strong> ${oc.transportVehicle || 'S/D'}</p></div><table class="table"><thead><tr><th>Producto</th><th>Cantidad</th></tr></thead><tbody>${oc.articles.map(a => `<tr><td>${a.name.toUpperCase()}</td><td>${a.qty}</td></tr>`).join('')}</tbody></table><div class="footer">Documento generado por SII Pallets - ${new Date().toLocaleString()}</div><script>window.onload=function(){window.print();window.close();}</script></body></html>`;
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const formatWhatsAppMessage = (load) => {
    if (!load) return "";
    let msg = `*📦 REPORTE DE ENTREGA - SII PALLETS*\n👤 *Cliente:* ${load.customer.toUpperCase()}\n📅 *Fecha:* ${load.date}\n⏰ *Hora:* ${load.time}hs\n📄 *OC:* ${load.poNumber || 'N/A'}\n\n*LOGÍSTICA:* \n🚚 *Transporte:* ${load.transportName || 'S/D'}\n👤 *Chofer:* ${load.transportDriver || 'S/D'}\n🚛 *Vehículo:* ${load.transportVehicle || 'S/D'}\n📦 *Pallets:* ${load.pallets}\n✅ *Estado:* ${load.status.toUpperCase()}`;
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

  // --- VISTAS ---
  if (authLoading) return <div className="h-screen flex items-center justify-center bg-emerald-900 text-white font-black italic animate-pulse">SII PALLETS v4.3...</div>;

  if (!user) {
    return (
      <div className="h-screen bg-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="bg-white w-full max-w-sm rounded-[3rem] shadow-2xl p-10 flex flex-col items-center">
          <div className="bg-emerald-800 p-6 rounded-full text-white mb-8 shadow-xl"><Lock size={40} /></div>
          <h1 className="text-2xl font-black text-slate-800 uppercase italic">SII PALLETS</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10 text-center">{isLoginView ? 'Ingreso Personal' : 'Nuevo Colaborador'}</p>
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-24 overflow-x-hidden antialiased">
      
      {/* HEADER */}
      <header className="bg-emerald-800 text-white p-6 rounded-b-[2.5rem] shadow-xl relative flex-shrink-0">
        <div className="flex justify-between items-start relative z-10">
          <div>
            <h1 className="text-2xl font-black uppercase italic text-white leading-none">SII PALLETS</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[9px] font-bold bg-emerald-900/40 px-3 py-1 rounded-full border border-emerald-500/20 uppercase text-emerald-200">
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

      {/* DASHBOARD PRINCIPAL */}
      <main className="px-5 -mt-6 relative z-20">
        
        {/* CALENDARIO */}
        <div className="bg-white rounded-[2.5rem] shadow-xl p-6 border border-slate-100 mb-8 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-7 gap-1 text-center mb-4 text-[9px] font-black text-slate-300 uppercase">
            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => <div key={`cal-h-${i}`}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((date, idx) => {
              const dStr = date ? date.toISOString().split('T')[0] : `empty-${idx}`;
              const isSelected = date && dStr === selectedDate.toISOString().split('T')[0];
              const hasEvents = date && loads.some(l => l.date === dStr);
              return (
                <button key={`cb-${idx}-${dStr}`} disabled={!date} onClick={() => setSelectedDate(date)}
                  className={`h-10 rounded-2xl flex flex-col items-center justify-center relative transition-all 
                  ${!date ? 'opacity-0' : 'opacity-100'} 
                  ${isSelected ? 'bg-emerald-600 text-white shadow-lg scale-105 z-10 font-black' : 'bg-slate-50 text-slate-400 active:scale-95'}`}>
                  <span className="text-xs">{date?.getDate()}</span>
                  {hasEvents && !isSelected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-0.5"></div>}
                </button>
              );
            })}
          </div>
        </div>

        {isAdmin && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button onClick={() => { setEditingId(null); setNewLoad(initialLoadState); setShowForm(true); }} className="bg-emerald-800 text-white p-5 rounded-[2rem] shadow-lg flex flex-col items-center gap-2 active:scale-95 transition-all"><Plus size={24} /><span className="text-[10px] font-black uppercase tracking-widest">Nueva Carga</span></button>
            <button onClick={() => setShowOCForm(true)} className="bg-indigo-700 text-white p-5 rounded-[2rem] shadow-lg flex flex-col items-center gap-2 active:scale-95 transition-all"><FilePlus size={24} /><span className="text-[10px] font-black uppercase tracking-widest">Generar OC</span></button>
          </div>
        )}

        {isAdmin && (
          <button onClick={() => setShowOCHistory(true)} className="w-full bg-white border-2 border-slate-100 p-4 rounded-[1.5rem] mb-8 flex items-center justify-center gap-3 active:scale-95 transition-all shadow-sm">
             <History size={18} className="text-indigo-600" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Historial OCs Internas</span>
          </button>
        )}

        <div className="relative mb-8">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input type="text" placeholder="Buscar Cliente..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border-2 border-slate-50 rounded-3xl py-4 pl-14 pr-6 text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all" />
        </div>

        {/* LISTADO DE HOY */}
        <div className="space-y-4 pb-10">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-4 flex items-center gap-2 mb-2 italic"><ClipboardList size={14}/> Hoja de Ruta - {selectedDate.toLocaleDateString()}</h3>
          {filteredDayLoads.length > 0 ? filteredDayLoads.map(load => (
            <div key={load.id} onClick={() => setViewLoad(load)} className={`bg-white p-6 rounded-[2.5rem] shadow-sm border relative transition-all duration-300 active:scale-[0.98] ${(!load.transportName || load.transportName.trim() === "") ? 'border-rose-200 ring-4 ring-rose-50 animate-pulse' : 'border-slate-100 hover:border-emerald-100'}`}>
              <div className="flex justify-between items-start mb-4">
                 <div className="flex-1">
                   <button onClick={(e) => { e.stopPropagation(); if(isAdmin) setQuickStatusLoad(load); }} className={`text-[8px] font-black uppercase px-2 py-1 rounded-full shadow-sm transition-all ${load.status === 'Entregado' ? 'bg-emerald-100 text-emerald-700' : load.status === 'En Proceso' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{load.status}</button>
                   <h4 className="font-black text-slate-900 text-lg uppercase mt-2 leading-tight flex items-center gap-2">{load.customer} <Eye size={14} className="text-slate-200" /></h4>
                 </div>
                 {isAdmin && (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { 
                          setEditingId(load.id); 
                          setNewLoad({ ...load }); // EDICIÓN TOTAL: CARGA TODOS LOS DATOS
                          setShowForm(true); 
                        }} className="p-2 text-slate-200 hover:text-blue-500 active:scale-110 transition-all"><Edit3 size={18} /></button>
                      <button onClick={() => deleteLoad(load.id)} className="p-2 text-slate-200 hover:text-rose-500 active:scale-110 transition-all"><Trash2 size={18} /></button>
                  </div>
                 )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-slate-400">
                <div className="flex items-center gap-1"><Clock size={12} /> {load.time} HS</div>
                <div className="flex items-center gap-1"><Package size={12} /> {load.pallets} PLTS</div>
              </div>
            </div>
          )) : (
            <div className="text-center py-20 bg-slate-200/10 rounded-[4rem] border-2 border-dashed border-slate-200 flex flex-col items-center">
              <Package size={40} className="text-slate-200 mb-4" />
              <p className="text-slate-300 font-black uppercase text-[10px] italic tracking-widest">Sin entregas para hoy</p>
            </div>
          )}
        </div>
      </main>

      {/* MODAL: FORMULARIO ENTREGA (EDICIÓN TOTAL + FLETE DETALLADO) */}
      {showForm && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] flex items-end justify-center backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[3.5rem] shadow-2xl p-8 overflow-y-auto max-h-[92vh] animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4"><h2 className="text-xl font-black text-slate-800 uppercase italic">{editingId ? 'Editar Entrega' : 'Nueva Entrega'}</h2><button onClick={() => { setShowForm(false); setEditingId(null); setSelectedInternalOCId(null); }} className="p-3 bg-slate-100 rounded-2xl active:scale-90 transition-all"><X size={24} /></button></div>
            <form onSubmit={handleSaveLoad} className="space-y-6 pb-6 text-slate-900">
              <div className="flex gap-2">{['Pendiente', 'En Proceso', 'Entregado'].map(s => (<button key={`st-opt-${s}`} type="button" onClick={() => setNewLoad({...newLoad, status: s})} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${newLoad.status === s ? 'bg-emerald-800 border-emerald-800 text-white shadow-xl shadow-emerald-100' : 'bg-white text-slate-300 border-slate-100 hover:border-slate-200 transition-all'}`}>{s}</button>))}</div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 italic">Fecha</label>
                  <input type="date" required value={newLoad.date} onChange={e => setNewLoad({...newLoad, date: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-black shadow-inner" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 italic">Hora</label>
                  <input type="time" required value={newLoad.time} onChange={e => setNewLoad({...newLoad, time: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-black shadow-inner" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-2 italic">Cliente</label>
                <input type="text" required placeholder="NOMBRE DEL CLIENTE" value={newLoad.customer} onChange={e => setNewLoad({...newLoad, customer: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-5 text-sm font-black uppercase shadow-inner" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase ml-2 italic">Turno</label>
                   <input type="text" placeholder="TURNO N°" value={newLoad.turnNumber} onChange={e => setNewLoad({...newLoad, turnNumber: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-5 text-sm font-black text-emerald-600 shadow-inner" />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase ml-2 italic">Orden Compra</label>
                   <div className="relative">
                      <input type="text" placeholder="OC-" value={newLoad.poNumber} onChange={e => setNewLoad({...newLoad, poNumber: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-5 text-sm font-black uppercase pr-12 shadow-inner" />
                      {!editingId && <button type="button" onClick={() => setShowOCPicker(true)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl active:scale-90 transition-all shadow-md"><ListFilter size={18} /></button>}
                   </div>
                </div>
              </div>

              {/* SECCIÓN FLETE DETALLADO */}
              <div className="bg-slate-50 p-6 rounded-[2.5rem] space-y-4 border border-slate-100 shadow-inner">
                <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2 italic"><Truck size={14}/> Flete Detallado</p>
                <input type="text" placeholder="EMPRESA DE TRANSPORTE" value={newLoad.transportName} onChange={e => setNewLoad({...newLoad, transportName: e.target.value})} className="w-full bg-white rounded-xl p-4 text-xs font-black shadow-sm uppercase" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="NOMBRE CHOFER" value={newLoad.transportDriver} onChange={e => setNewLoad({...newLoad, transportDriver: e.target.value})} className="w-full bg-white rounded-xl p-4 text-xs font-black shadow-sm uppercase" />
                  <input type="text" placeholder="PATENTE / VEHÍCULO" value={newLoad.transportVehicle} onChange={e => setNewLoad({...newLoad, transportVehicle: e.target.value})} className="w-full bg-white rounded-xl p-4 text-xs font-black shadow-sm uppercase" />
                </div>
              </div>

              {/* FINANZAS */}
              <div className="bg-emerald-50 p-6 rounded-[2.5rem] space-y-4 border border-emerald-100 shadow-inner">
                <p className="text-[9px] font-black text-emerald-800 uppercase flex items-center gap-2 italic"><DollarSign size={14}/> Administración / Precios</p>
                <div className="grid grid-cols-2 gap-4">
                   <input type="text" placeholder="COND. PAGO" value={newLoad.paymentCondition} onChange={e => setNewLoad({...newLoad, paymentCondition: e.target.value})} className="bg-white rounded-xl p-4 text-xs font-black shadow-sm uppercase" />
                   <input type="number" placeholder="PRECIO $" value={newLoad.price} onChange={e => setNewLoad({...newLoad, price: e.target.value})} className="bg-white rounded-xl p-4 text-xs font-black shadow-sm" />
                </div>
                <div className="flex gap-2">
                  {['Cta 1', 'Cta 2'].map(cta => (
                    <button key={`load-cta-${cta}`} type="button" onClick={() => setNewLoad({...newLoad, accountType: cta})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${newLoad.accountType === cta ? 'bg-emerald-800 border-emerald-800 text-white shadow-md' : 'bg-white text-emerald-300 border-emerald-100'}`}>{cta}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase ml-2 italic">Pallets Totales</label>
                   <input type="number" placeholder="0" required value={newLoad.pallets} onChange={e => setNewLoad({...newLoad, pallets: e.target.value})} className="bg-slate-50 rounded-2xl p-5 text-sm font-black shadow-inner w-full" />
                </div>
                <div className="flex items-center gap-2 px-2 text-[10px] font-black text-slate-300 uppercase italic leading-tight">Total carga registrada</div>
              </div>

              <div className="space-y-4">
                 <div className="flex justify-between items-center px-2"><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Productos</h3><button type="button" onClick={() => setNewLoad(p => ({...p, articles: [...p.articles, {name:"", feature:""}]}))} className="bg-emerald-700 text-white p-2 rounded-xl active:scale-90 shadow-md"><Plus size={16} /></button></div>
                 {newLoad.articles.map((art, idx) => (
                    <div key={`edit-art-ln-${idx}`} className="flex gap-2 animate-in slide-in-from-left-2">
                       <input type="text" placeholder="Producto" required value={art.name} onChange={e => { const u = [...newLoad.articles]; u[idx].name = e.target.value; setNewLoad({...newLoad, articles: u}); }} className="flex-1 bg-slate-50 border-none rounded-2xl p-4 text-[11px] font-black uppercase shadow-inner" />
                       <input type="text" placeholder="Cant." value={art.feature} onChange={e => { const u = [...newLoad.articles]; u[idx].feature = e.target.value; setNewLoad({...newLoad, articles: u}); }} className="w-24 bg-slate-50 border-none rounded-2xl p-4 text-[11px] font-black uppercase text-center shadow-inner" />
                    </div>
                 ))}
              </div>

              <button type="submit" className="w-full bg-emerald-800 text-white font-black py-6 rounded-[2.5rem] shadow-2xl uppercase tracking-widest text-sm active:scale-95 transition-all flex items-center justify-center gap-3"><Save size={20} /> GUARDAR CAMBIOS</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA OC (EDICIÓN TOTAL + SUB-FLETE) */}
      {showOCForm && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] flex items-end justify-center p-0 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[3.5rem] shadow-2xl p-8 overflow-y-auto max-h-[95vh] animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4"><h2 className="text-xl font-black text-slate-800 uppercase italic">Generar OC Interna</h2><button onClick={() => setShowOCForm(false)} className="p-3 bg-slate-100 rounded-2xl active:scale-90 transition-all"><X size={20} /></button></div>
            <form onSubmit={handleGenerateOC} className="space-y-6 pb-6 text-slate-900">
              <input type="text" required placeholder="NOMBRE DEL CLIENTE" value={newOC.customer} onChange={e => setNewOC({...newOC, customer: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-black uppercase shadow-inner" />
              
              <div className="bg-emerald-50 p-6 rounded-[2.5rem] space-y-4 border border-emerald-100 shadow-inner">
                <p className="text-[9px] font-black text-emerald-800 uppercase flex items-center gap-2 italic"><DollarSign size={14}/> Administración / Precios</p>
                <div className="grid grid-cols-2 gap-4">
                   <input type="text" placeholder="COND. PAGO" value={newOC.paymentCondition} onChange={e => setNewOC({...newOC, paymentCondition: e.target.value})} className="bg-white rounded-xl p-4 text-xs font-black shadow-sm uppercase" />
                   <input type="number" placeholder="PRECIO $" value={newOC.price} onChange={e => setNewOC({...newOC, price: e.target.value})} className="bg-white rounded-xl p-4 text-xs font-black shadow-sm" />
                </div>
                <div className="flex gap-2">
                  {['Cta 1', 'Cta 2'].map(cta => (
                    <button key={`oc-cta-${cta}`} type="button" onClick={() => setNewOC({...newOC, accountType: cta})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${newOC.accountType === cta ? 'bg-emerald-800 border-emerald-800 text-white shadow-md' : 'bg-white text-emerald-300 border-emerald-100'}`}>{cta}</button>
                  ))}
                </div>
              </div>

              {/* SUB-FLETE EN OC */}
              <div className="bg-slate-50 p-6 rounded-[2.5rem] space-y-4 border border-slate-100 shadow-inner">
                <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2 italic"><Truck size={14}/> Logística Sugerida</p>
                <input type="text" placeholder="EMPRESA TRANSPORTE" value={newOC.transportName} onChange={e => setNewOC({...newOC, transportName: e.target.value})} className="w-full bg-white rounded-xl p-4 text-xs font-black shadow-sm uppercase" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="CHOFER" value={newOC.transportDriver} onChange={e => setNewOC({...newOC, transportDriver: e.target.value})} className="bg-white rounded-xl p-4 text-xs font-black shadow-sm uppercase" />
                  <input type="text" placeholder="PATENTE" value={newOC.transportVehicle} onChange={e => setNewOC({...newOC, transportVehicle: e.target.value})} className="bg-white rounded-xl p-4 text-xs font-black shadow-sm uppercase" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <input type="date" required value={newOC.date} onChange={e => setNewOC({...newOC, date: e.target.value})} className="bg-slate-50 rounded-2xl p-5 text-sm font-black shadow-inner" />
                 <input type="text" placeholder="TURNO / REF" value={newOC.turn} onChange={e => setNewOC({...newOC, turn: e.target.value})} className="bg-slate-50 rounded-2xl p-5 text-sm font-black uppercase shadow-inner" />
              </div>
              
              <div className="space-y-4">
                 <div className="flex justify-between items-center px-2"><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Artículos</h3><button type="button" onClick={() => setNewOC({...newOC, articles: [...newOC.articles, {name:"", qty:""}]})} className="bg-indigo-600 text-white p-2 rounded-xl active:scale-90 shadow-md transition-all"><Plus size={18} /></button></div>
                 {newOC.articles.map((art, idx) => (
                    <div key={`row-oc-new-${idx}`} className="flex gap-2 animate-in slide-in-from-left-2">
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

      {/* --- MODAL ALERTAS --- */}
      {showAlerts && (
        <div className="fixed inset-0 bg-slate-900/90 z-[160] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-emerald-50">
              <h2 className="text-xl font-black text-emerald-900 uppercase italic">Notificaciones</h2>
              <button onClick={() => setShowAlerts(false)} className="p-3 bg-white rounded-2xl active:scale-90 transition-all shadow-sm"><X size={20} /></button>
            </div>
            <div className="p-8 overflow-y-auto max-h-[60vh] hide-scrollbar text-center">
              <button onClick={requestNotifPermission} className="w-full py-4 bg-emerald-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest mb-6 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-3">{notifPermission === 'granted' ? <><Check size={16}/> Alertas Activas</> : <><BellRing size={16}/> Activar Alertas</>}</button>
              {internalAlerts.length > 0 ? internalAlerts.map((a, i) => (
                <div key={`alert-i-${i}`} onClick={() => { const target = loads.find(l => l.id === a.loadId); if(target) setViewLoad(target); setShowAlerts(false); }} className={`p-5 rounded-3xl border-2 flex items-center gap-4 mb-3 text-left shadow-sm cursor-pointer active:scale-95 transition-all ${a.type === 'proximity' ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100'}`}>
                  {a.type === 'proximity' ? <CalendarIcon size={24} className="text-amber-600 shrink-0" /> : <AlertTriangle size={24} className="text-rose-600 shrink-0" />}
                  <div><p className={`text-[10px] font-black uppercase ${a.type === 'proximity' ? 'text-amber-900' : 'text-rose-900'}`}>{a.title}</p><p className={`text-xs font-bold ${a.type === 'proximity' ? 'text-amber-500' : 'text-rose-500'}`}>{a.message}</p></div>
                </div>
              )) : <div className="py-10"><Check size={40} className="mx-auto text-emerald-500 mb-2" /><p className="text-xs font-black text-slate-300 uppercase tracking-widest italic">Todo bajo control</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* HISTORIAL OC */}
      {showOCHistory && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/90 z-[200] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-indigo-50"><div><h2 className="text-xl font-black text-indigo-900 uppercase italic">Historial OCs</h2><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1 italic">Gestión de documentos</p></div><button onClick={() => setShowOCHistory(false)} className="p-3 bg-white rounded-2xl active:scale-90 transition-all shadow-sm"><X size={20} /></button></div>
            <div className="p-4 bg-slate-50 border-b relative"><Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-300" size={14} /><input type="text" placeholder="BUSCAR POR CLIENTE O N°..." value={ocSearchQuery} onChange={e => setOcSearchQuery(e.target.value)} className="w-full bg-white rounded-xl py-3 pl-12 pr-6 text-[10px] font-black uppercase shadow-inner" /></div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto hide-scrollbar bg-white">
              {filteredOCHistory.map((oc) => (
                <div key={`h-oc-${oc.id}`} className="bg-white border-2 border-slate-50 p-4 rounded-[2rem] flex items-center justify-between shadow-sm hover:border-indigo-200 transition-all"><div className="flex-1"><div className="flex items-center gap-2"><span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${oc.isUsed ? 'bg-slate-100 text-slate-400' : 'bg-emerald-100 text-emerald-700'}`}>{oc.isUsed ? 'PROCESADA' : 'PENDIENTE'}</span><p className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">N° {oc.ocNumber}</p></div><p className="text-xs font-black text-slate-900 uppercase mt-1 truncate max-w-[150px]">{oc.customer}</p><p className="text-[9px] font-bold text-slate-400">{oc.date}</p></div><button onClick={() => printOC(oc)} className="p-4 bg-slate-100 rounded-2xl text-slate-500 hover:bg-indigo-600 hover:text-white transition-all active:scale-90 shadow-sm"><Printer size={20}/></button></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SELECTOR OC PARA CARGA */}
      {showOCPicker && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/80 z-[250] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-indigo-50"><h2 className="text-xl font-black text-indigo-900 uppercase italic">OC Pendientes</h2><button onClick={() => setShowOCPicker(false)} className="p-3 bg-white rounded-2xl active:scale-90 transition-all"><X size={20} /></button></div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto hide-scrollbar">
              {availableOCs.length > 0 ? availableOCs.map((oc) => (
                <div key={`p-oc-${oc.id}`} onClick={() => selectOC(oc)} className="bg-white border-2 border-slate-50 p-5 rounded-[2rem] flex items-center justify-between cursor-pointer hover:border-indigo-500 active:scale-[0.98] transition-all shadow-sm"><div className="flex items-center gap-5"><FileText size={24} className="text-indigo-600" /><div><p className="text-xs font-black uppercase text-slate-900 leading-tight">{oc.customer}</p><p className="text-[10px] font-bold text-indigo-500 uppercase">OC #{oc.ocNumber}</p></div></div><ArrowRight size={20} className="text-slate-200" /></div>
              )) : <div className="text-center py-10 text-slate-300 font-black uppercase text-[10px] italic">Sin OCs pendientes</div>}
            </div>
          </div>
        </div>
      )}

      {/* OC SUCCESS */}
      {ocSuccess && (
        <div className="fixed inset-0 bg-slate-900/95 z-[300] flex items-center justify-center p-6 backdrop-blur-md animate-in zoom-in-95">
          <div className="bg-white w-full max-w-md rounded-[3.5rem] shadow-2xl p-10 flex flex-col items-center text-center">
            <Check size={48} className="text-emerald-600 mb-6 bg-emerald-50 p-2 rounded-full" />
            <h2 className="text-2xl font-black text-slate-800 uppercase italic mb-2 leading-tight tracking-tighter">OC GENERADA</h2>
            <p className="text-4xl font-black text-emerald-700 mb-8 tracking-tighter italic">N° {ocSuccess.ocNumber}</p>
            <div className="grid grid-cols-1 w-full gap-4">
               <button onClick={() => copyToClipboard(formatOCWhatsApp(ocSuccess))} className={`w-full py-5 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-3 transition-all ${copyFeedback ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-200' : 'bg-emerald-800 text-white shadow-xl active:scale-95'}`}>{copyFeedback ? '¡COPIADO!' : 'COPIAR WHATSAPP'}</button>
               <button onClick={() => printOC(ocSuccess)} className="w-full py-5 bg-slate-50 text-slate-500 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-3 active:bg-slate-100 border-2 border-slate-100 shadow-sm transition-all">IMPRIMIR / PDF</button>
            </div>
            <button onClick={() => setOcSuccess(null)} className="mt-8 text-[10px] font-black text-slate-300 uppercase underline tracking-[0.2em]">Cerrar</button>
          </div>
        </div>
      )}

      {/* REPORTE WHATSAPP */}
      {shareLoad && (
        <div className="fixed inset-0 bg-slate-900/90 z-[210] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8"><h2 className="text-2xl font-black text-slate-800 uppercase italic flex items-center gap-4 tracking-tighter"><Share2 size={24} className="text-emerald-700" /> Reporte</h2><button onClick={() => setShareLoad(null)} className="p-3 bg-slate-100 rounded-full text-slate-300 active:scale-90 transition-all shadow-sm"><X size={20} /></button></div>
            <div className="flex-1 bg-slate-50 rounded-[2.5rem] p-8 overflow-y-auto mb-10 border-2 border-slate-100 shadow-inner"><pre className="text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">{formatWhatsAppMessage(shareLoad)}</pre></div>
            <button onClick={() => copyToClipboard(formatWhatsAppMessage(shareLoad))} className={`w-full py-7 rounded-[2.5rem] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-4 transition-all shadow-xl ${copyFeedback ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-200' : 'bg-emerald-800 text-white active:scale-95'}`}>{copyFeedback ? '¡COPIADO!' : 'COPIAR PARA WHATSAPP'}</button>
          </div>
        </div>
      )}

      {/* SELECTOR ESTADO RÁPIDO */}
      {quickStatusLoad && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 z-[150] flex items-center justify-center p-12 backdrop-blur-sm animate-in fade-in transition-all">
          <div className="bg-white w-full max-w-xs rounded-[3rem] shadow-2xl p-8 animate-in zoom-in-95">
            <h3 className="text-center font-black text-slate-400 text-[10px] uppercase mb-8 tracking-widest italic">Actualizar Estado</h3>
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
