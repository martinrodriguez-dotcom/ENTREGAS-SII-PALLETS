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
  Edit3, Search, ListOrdered, Save, Cloud, 
  Share2, Copy, Check, Bell, FilePlus, FileText, Printer, ArrowRight
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
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loads, setLoads] = useState([]);
  const [internalOCs, setInternalOCs] = useState([]);
  
  // Nombres de los meses (Corrigiendo el ReferenceError)
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
                      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  // Modales
  const [showForm, setShowForm] = useState(false);
  const [showOCForm, setShowOCForm] = useState(false);
  const [ocSuccess, setOcSuccess] = useState(null);
  const [viewLoad, setViewLoad] = useState(null); 
  const [shareLoad, setShareLoad] = useState(null);
  const [quickStatusLoad, setQuickStatusLoad] = useState(null);
  const [message, setMessage] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Estados de formularios
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
    turn: "Mañana",
    articles: [{ name: "", qty: "" }]
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
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

  useEffect(() => {
    if (!user) return;
    const loadsRef = collection(db, 'artifacts', appId, 'public', 'data', 'loads');
    const ocsRef = collection(db, 'artifacts', appId, 'public', 'data', 'internal_ocs');

    const unsubLoads = onSnapshot(loadsRef, (snap) => {
      setLoads(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error(err));
    
    const unsubOCs = onSnapshot(ocsRef, (snap) => {
      setInternalOCs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error(err));

    return () => { unsubLoads(); unsubOCs(); };
  }, [user]);

  // --- LÓGICA DE CORRELATIVIDAD ---
  const nextOCNumber = useMemo(() => {
    if (internalOCs.length === 0) return "0001";
    const nums = internalOCs.map(o => parseInt(o.ocNumber)).filter(n => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return (max + 1).toString().padStart(4, '0');
  }, [internalOCs]);

  // --- ACCIONES ---
  const handleSaveLoad = async (e) => {
    e.preventDefault();
    if (!user) return;
    const id = editingId || Date.now().toString();
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'loads', id);
    try {
      await setDoc(docRef, { ...newLoad, id, updatedAt: new Date().toISOString() });
      setShowForm(false);
      setEditingId(null);
      setNewLoad(initialLoadState);
      setMessage({ type: 'success', text: 'Carga guardada correctamente' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Error al guardar la carga' });
    }
  };

  const handleGenerateOC = async (e) => {
    e.preventDefault();
    if (!user) return;
    const ocNumber = nextOCNumber;
    const id = Date.now().toString();
    const ocData = { ...newOC, id, ocNumber, createdAt: new Date().toISOString() };
    
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'internal_ocs', id);
      await setDoc(docRef, ocData);
      setOcSuccess(ocData);
      setShowOCForm(false);
      setNewOC({ customer: "", date: new Date().toISOString().split('T')[0], turn: "Mañana", articles: [{ name: "", qty: "" }] });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Error al generar la OC' });
    }
  };

  const updateQuickStatus = async (id, newStatus) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loads', id), { status: newStatus });
      setQuickStatusLoad(null);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteLoad = async (id) => {
    if (!user) return;
    // Usamos un modal personalizado en lugar de confirm() si fuera necesario, 
    // pero para brevedad mantendremos la lógica lógica con un estado de confirmación.
    if (window.confirm("¿Seguro que deseas eliminar esta carga?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loads', id));
    }
  };

  const printOC = (oc) => {
    const printWindow = window.open('', '_blank');
    const content = `
      <html>
        <head>
          <title>Orden de Compra ${oc.ocNumber}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.6; }
            .header { text-align: center; border-bottom: 3px solid #065f46; padding-bottom: 20px; margin-bottom: 30px; }
            .details { margin-bottom: 30px; display: grid; grid-template-cols: 1fr 1fr; gap: 20px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .table th, .table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            .table th { background: #f8fafc; font-weight: bold; }
            .footer { margin-top: 60px; font-size: 11px; text-align: center; color: #94a3b8; border-top: 1px solid #e2e8f0; pt: 20px; }
            h1 { color: #065f46; margin: 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ORDEN DE COMPRA INTERNA</h1>
            <p style="font-weight: bold; font-size: 18px;">SII PALLETS LOGÍSTICA</p>
          </div>
          <div class="details">
            <div>
              <p><strong>Número de OC:</strong> #${oc.ocNumber}</p>
              <p><strong>Cliente:</strong> ${oc.customer.toUpperCase()}</p>
            </div>
            <div style="text-align: right;">
              <p><strong>Fecha Programada:</strong> ${oc.date}</p>
              <p><strong>Turno:</strong> ${oc.turn}</p>
            </div>
          </div>
          <table class="table">
            <thead>
              <tr><th>Producto / Artículo</th><th style="text-align: center;">Cantidad / Detalle</th></tr>
            </thead>
            <tbody>
              ${oc.articles.map(a => `<tr><td>${a.name.toUpperCase()}</td><td style="text-align: center;">${a.qty}</td></tr>`).join('')}
            </tbody>
          </table>
          <div class="footer">
            Documento generado digitalmente por el Sistema SII Pallets - ${new Date().toLocaleString()}
          </div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const formatOCWhatsApp = (oc) => {
    const art = oc.articles.map(a => `• *${a.name.toUpperCase()}*: ${a.qty}`).join('\n');
    return `*📄 ORDEN DE COMPRA INTERNA #${oc.ocNumber}*\n*SII PALLETS LOGÍSTICA*\n\n👤 *Cliente:* ${oc.customer.toUpperCase()}\n📅 *Fecha:* ${oc.date}\n⏰ *Turno:* ${oc.turn}\n\n*DETALLE:*\n${art}\n\n_Generado vía APP SII PALLETS_`;
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

  // --- UI HELPERS ---
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

  if (loading) return <div className="h-screen flex items-center justify-center bg-emerald-900 text-white font-black uppercase tracking-widest text-center">SII PALLETS...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-24">
      
      {/* MENSAJES FLOTANTES */}
      {message && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4">
          <div className={`px-6 py-3 rounded-full shadow-2xl text-white text-xs font-black uppercase tracking-widest flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            {message.type === 'success' ? <Check size={16} /> : <X size={16} />}
            {message.text}
            <button onClick={() => setMessage(null)} className="ml-2 opacity-50"><X size={14} /></button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-emerald-800 text-white p-6 rounded-b-[2.5rem] shadow-xl relative overflow-hidden flex-shrink-0">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 -mr-16 -mt-16 rounded-full"></div>
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none italic">SII PALLETS</h1>
            <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-200 bg-emerald-900/40 px-3 py-1 rounded-full mt-3 w-fit">
              <Cloud size={10} className="animate-pulse" /> SINCRO NUBE OK
            </div>
          </div>
          <button className="p-3 bg-white/10 rounded-2xl border border-white/10 active:scale-95 transition-all">
            <Bell size={20} />
          </button>
        </div>

        <div className="flex justify-between items-center bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/10">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 active:scale-90"><ChevronLeft size={20} /></button>
          <h2 className="text-xs font-black uppercase tracking-widest">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 active:scale-90"><ChevronRight size={20} /></button>
        </div>
      </header>

      {/* DASHBOARD PRINCIPAL */}
      <main className="px-5 -mt-6 relative z-20">
        
        {/* CALENDARIO */}
        <div className="bg-white rounded-[2.5rem] shadow-xl p-6 border border-slate-100 mb-8">
          <div className="grid grid-cols-7 gap-1 text-center mb-4 text-[9px] font-black text-slate-300 uppercase">
            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((date, idx) => {
              const key = date ? `cal-${date.toISOString()}` : `empty-${idx}`;
              const isSelected = date && date.toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0];
              const hasEvents = date && loads.some(l => l.date === date.toISOString().split('T')[0]);
              return (
                <button key={key} disabled={!date} onClick={() => setSelectedDate(date)}
                  className={`h-10 rounded-2xl flex flex-col items-center justify-center relative transition-all
                    ${!date ? 'opacity-0' : 'opacity-100'}
                    ${isSelected ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 active:scale-95'}
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
             <span className="text-[10px] font-black uppercase tracking-widest">Nueva Entrega</span>
           </button>
           <button onClick={() => setShowOCForm(true)}
            className="bg-indigo-700 text-white p-5 rounded-[2rem] shadow-lg flex flex-col items-center gap-2 active:scale-95 transition-all">
             <FilePlus size={24} />
             <span className="text-[10px] font-black uppercase tracking-widest">Generar OC</span>
           </button>
        </div>

        {/* BUSCADOR */}
        <div className="relative mb-8">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input type="text" placeholder="Buscar Cliente u OC..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border-2 border-slate-50 rounded-3xl py-4 pl-14 pr-6 shadow-sm text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" />
        </div>

        {/* LISTADO DE HOY */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 px-2">Hoja de Ruta del Día</h3>
          {filteredDayLoads.length > 0 ? filteredDayLoads.map(load => (
            <div key={load.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative group active:scale-[0.98] transition-all" onClick={() => setViewLoad(load)}>
              <div className="flex justify-between items-start mb-4">
                 <div className="flex-1">
                   <button onClick={(e) => { e.stopPropagation(); setQuickStatusLoad(load); }}
                    className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${
                      load.status === 'Entregado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>{load.status}</button>
                   <h4 className="font-black text-slate-900 text-lg uppercase mt-2 leading-tight">{load.customer}</h4>
                 </div>
                 <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingId(load.id); setNewLoad(load); setShowForm(true); }} className="p-2 text-slate-300 hover:text-blue-500 transition-colors"><Edit3 size={18} /></button>
                    <button onClick={() => deleteLoad(load.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                 </div>
              </div>
              <div className="flex gap-4 text-[10px] font-bold text-slate-400">
                <div className="flex items-center gap-1"><Clock size={12} /> {load.time} HS</div>
                <div className="flex items-center gap-1"><Package size={12} /> {load.pallets} PLTS</div>
                <div className="flex items-center gap-1"><Hash size={12} /> {load.poNumber || '-'}</div>
              </div>
            </div>
          )) : (
            <div className="text-center py-10 bg-slate-200/20 rounded-[3rem] border-2 border-dashed border-slate-200">
              <p className="text-slate-300 font-black uppercase text-[10px] italic tracking-widest">Sin registros para hoy</p>
            </div>
          )}
        </div>
      </main>

      {/* --- MODAL: NUEVA OC INTERNA --- */}
      {showOCForm && (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] flex items-end justify-center backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[3.5rem] shadow-2xl p-8 overflow-y-auto max-h-[95vh] animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex justify-between items-center mb-8 sticky top-0 bg-white py-2 z-10 border-b border-slate-100">
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase italic">Generar OC</h2>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Siguiente N°: {nextOCNumber}</p>
              </div>
              <button onClick={() => setShowOCForm(false)} className="p-4 bg-slate-100 rounded-[1.5rem] text-slate-400"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleGenerateOC} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Cliente</label>
                <input type="text" required value={newOC.customer} onChange={e => setNewOC({...newOC, customer: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-black uppercase" placeholder="RAZÓN SOCIAL" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Fecha Entrega</label>
                   <input type="date" required value={newOC.date} onChange={e => setNewOC({...newOC, date: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-5 text-sm font-black" />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Turno</label>
                   <select value={newOC.turn} onChange={e => setNewOC({...newOC, turn: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-black appearance-none">
                     <option>Mañana</option>
                     <option>Tarde</option>
                     <option>Noche</option>
                   </select>
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="flex justify-between items-center px-2">
                   <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalle de Productos</h3>
                   <button type="button" onClick={() => setNewOC({...newOC, articles: [...newOC.articles, {name:"", qty:""}]})} className="bg-indigo-600 text-white p-2 rounded-xl active:scale-90 transition-all"><Plus size={18} /></button>
                 </div>
                 {newOC.articles.map((art, idx) => (
                    <div key={`oc-art-${idx}`} className="flex gap-2 animate-in slide-in-from-left-2">
                       <input type="text" placeholder="Producto" required value={art.name} onChange={e => { const u = [...newOC.articles]; u[idx].name = e.target.value; setNewOC({...newOC, articles: u}); }} className="flex-1 bg-slate-50 border-none rounded-2xl p-4 text-xs font-black uppercase" />
                       <input type="text" placeholder="Detalle" required value={art.qty} onChange={e => { const u = [...newOC.articles]; u[idx].qty = e.target.value; setNewOC({...newOC, articles: u}); }} className="w-24 bg-slate-50 border-none rounded-2xl p-4 text-xs font-black uppercase text-center" />
                       {newOC.articles.length > 1 && <button type="button" onClick={() => {const u = [...newOC.articles]; u.splice(idx, 1); setNewOC({...newOC, articles: u});}} className="p-2 text-rose-300"><Trash2 size={18}/></button>}
                    </div>
                 ))}
              </div>

              <button type="submit" className="w-full bg-indigo-700 text-white font-black py-6 rounded-[2.5rem] shadow-2xl uppercase tracking-widest text-sm flex items-center justify-center gap-3 active:scale-95 transition-all">
                <FileText size={20} /> GENERAR OC
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: ÉXITO OC --- */}
      {ocSuccess && (
        <div className="fixed inset-0 bg-slate-900/95 z-[150] flex items-center justify-center p-6 backdrop-blur-md animate-in zoom-in-95">
          <div className="bg-white w-full rounded-[3.5rem] shadow-2xl p-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-6">
              <Check size={40} className="stroke-[3px]" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 uppercase italic leading-tight mb-2">OC GENERADA</h2>
            <p className="text-4xl font-black text-emerald-700 mb-8 tracking-tighter">N° {ocSuccess.ocNumber}</p>
            
            <div className="grid grid-cols-1 w-full gap-4">
               <button onClick={() => { copyToClipboard(formatOCWhatsApp(ocSuccess)); }}
                className={`w-full py-5 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-3 transition-all ${copyFeedback ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-200' : 'bg-emerald-800 text-white shadow-xl active:scale-95'}`}>
                 {copyFeedback ? <><Check size={18} /> ¡COPIADO!</> : <><Share2 size={18} /> COPIAR WHATSAPP</>}
               </button>
               <button onClick={() => printOC(ocSuccess)}
                className="w-full py-5 bg-slate-50 text-slate-500 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-3 active:bg-slate-100 transition-all border-2 border-slate-100">
                 <Printer size={18} /> IMPRIMIR / PDF
               </button>
            </div>
            
            <button onClick={() => setOcSuccess(null)} className="mt-8 text-[10px] font-black text-slate-300 uppercase underline tracking-[0.2em]">Cerrar</button>
          </div>
        </div>
      )}

      {/* --- MODAL: FORMULARIO ENTREGA (CLÁSICO) --- */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/90 z-[100] flex items-end justify-center backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[3.5rem] shadow-2xl p-8 overflow-y-auto max-h-[92%] animate-in slide-in-from-bottom-10 duration-500">
            <div className="flex justify-between items-center mb-8 sticky top-0 bg-white py-2 z-10 border-b border-slate-50">
              <h2 className="text-2xl font-black text-slate-800 uppercase italic">{editingId ? 'Editar' : 'Nueva'} Entrega</h2>
              <button onClick={() => setShowForm(false)} className="p-4 bg-slate-100 rounded-[1.5rem] text-slate-400 transition-all active:scale-90"><X size={24} /></button>
            </div>
            <form onSubmit={handleSaveLoad} className="space-y-6">
              <div className="flex gap-2">
                {['Pendiente', 'Entregado'].map(s => (
                  <button key={`stat-${s}`} type="button" onClick={() => setNewLoad({...newLoad, status: s})} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${newLoad.status === s ? 'bg-emerald-800 border-emerald-800 text-white shadow-xl' : 'bg-white text-slate-300 border-slate-50'}`}>{s}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="date" required value={newLoad.date} onChange={e => setNewLoad({...newLoad, date: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-4 text-sm font-black focus:ring-2 focus:ring-emerald-500" />
                <input type="time" required value={newLoad.time} onChange={e => setNewLoad({...newLoad, time: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-4 text-sm font-black focus:ring-2 focus:ring-emerald-500" />
              </div>
              <input type="text" placeholder="Cliente / Destino" required value={newLoad.customer} onChange={e => setNewLoad({...newLoad, customer: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-black uppercase placeholder:text-slate-300" />
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="Turno N°" required value={newLoad.turnNumber} onChange={e => setNewLoad({...newLoad, turnNumber: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-5 text-sm font-black text-emerald-600 placeholder:text-slate-300" />
                <input type="text" placeholder="OC-" value={newLoad.poNumber} onChange={e => setNewLoad({...newLoad, poNumber: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-5 text-sm font-black uppercase font-mono placeholder:text-slate-300" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Pallets" required value={newLoad.pallets} onChange={e => setNewLoad({...newLoad, pallets: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-5 text-sm font-black" />
                <input type="text" placeholder="Flete" value={newLoad.transport} onChange={e => setNewLoad({...newLoad, transport: e.target.value})} className="bg-slate-50 border-none rounded-2xl p-5 text-sm font-black" />
              </div>

              <button type="submit" className="w-full bg-emerald-800 text-white font-black py-6 rounded-[2.5rem] shadow-2xl uppercase tracking-widest text-sm active:scale-95 transition-all"><Save className="inline mr-2" size={20} /> GUARDAR</button>
            </form>
          </div>
        </div>
      )}

      {/* --- QUICK STATUS SELECTOR --- */}
      {quickStatusLoad && (
        <div className="fixed inset-0 bg-slate-900/60 z-[150] flex items-center justify-center p-12 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xs rounded-[3rem] shadow-2xl p-8 animate-in zoom-in-95">
            <h3 className="text-center font-black text-slate-400 text-[10px] uppercase mb-8 tracking-widest italic leading-relaxed">Actualizar Estado</h3>
            <div className="space-y-4">
              {['Pendiente', 'Entregado'].map(s => (
                <button key={`quick-status-${s}`} onClick={() => updateQuickStatus(quickStatusLoad.id, s)}
                  className={`w-full py-5 rounded-[1.5rem] font-black uppercase text-xs transition-all border-4 
                    ${quickStatusLoad.status === s ? 'bg-emerald-800 border-emerald-800 text-white shadow-xl' : 'bg-slate-50 border-slate-50 text-slate-400'}`}>
                  {s}
                </button>
              ))}
              <button onClick={() => setQuickStatusLoad(null)} className="w-full py-4 text-[10px] font-black text-rose-400 uppercase mt-4 rounded-2xl transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* --- DETALLE MODAL --- */}
      {viewLoad && (
        <div className="fixed inset-0 bg-slate-900/95 z-[100] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
            <div className="p-8 bg-emerald-800 text-white flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black uppercase italic leading-tight">{viewLoad.customer}</h2>
                <p className="text-emerald-200 text-xs font-bold mt-1 tracking-widest">{viewLoad.date} • {viewLoad.time} HS</p>
              </div>
              <button onClick={() => setViewLoad(null)} className="p-3 bg-white/10 rounded-2xl"><X size={20}/></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-slate-50 p-4 rounded-3xl">
                   <p className="text-[9px] font-black text-slate-300 uppercase">OC</p>
                   <p className="text-sm font-black">{viewLoad.poNumber || '-'}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-3xl">
                   <p className="text-[9px] font-black text-slate-300 uppercase">Turno</p>
                   <p className="text-sm font-black text-emerald-600">#{viewLoad.turnNumber || '-'}</p>
                </div>
              </div>
              <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100">
                <p className="text-[9px] font-black text-emerald-400 uppercase mb-2">Datos Logística</p>
                <p className="text-sm font-black text-emerald-900 flex items-center gap-2"><Truck size={16}/> {viewLoad.transport || 'Flete pendiente'}</p>
                <p className="text-lg font-black text-emerald-900 mt-2">{viewLoad.pallets} Pallets Totales</p>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t flex gap-3">
               <button onClick={() => {setEditingId(viewLoad.id); setNewLoad(viewLoad); setShowForm(true); setViewLoad(null);}} className="flex-1 py-4 bg-white border-2 border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-400">Editar</button>
               <button onClick={() => {setShareLoad(viewLoad); setViewLoad(null);}} className="flex-1 py-4 bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg">Reporte</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
