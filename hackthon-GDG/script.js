const { useState, useEffect, useMemo, useRef } = React;

const CATEGORIES = ["All", "Technical", "Home Services", "Creative", "Health"];

// Reputation Tier Logic
function getReputationBadge(completedCount, avgRating) {
    if (completedCount >= 6 && avgRating >= 4.8) return { label: "Elite Gold", color: "bg-amber-500", icon: "🔱" };
    if (completedCount >= 3 && avgRating >= 4.5) return { label: "Top Performer", color: "bg-indigo-600", icon: "🏆" };
    if (completedCount >= 1) return { label: "Rising Star", color: "bg-green-500", icon: "🚀" };
    return { label: "New Pro", color: "bg-slate-400", icon: "✨" };
}

// Shared Timer Component
function AuctionTimer({ deadline, status }) {
    const [timeLeft, setTimeLeft] = useState("");
    useEffect(() => {
        if (status === 'closed') { setTimeLeft("HIRED"); return; }
        if (status === 'completed') { setTimeLeft("FINISHED"); return; }
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const target = new Date(deadline).getTime();
            const diff = target - now;
            if (diff <= 0) { setTimeLeft("EXPIRED"); clearInterval(interval); }
            else {
                const h = Math.floor(diff / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft(`${h}h ${m}m ${s}s`);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [deadline, status]);
    return (
        <div className={`flex items-center gap-2 font-black text-[10px] uppercase tracking-widest px-3 py-1 rounded-full ${status === 'completed' ? 'bg-amber-100 text-amber-600' : (status === 'closed' ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-500')}`}>
            <span>{status === 'completed' ? '🏆' : (status === 'closed' ? '✅' : '⌛')}</span> {timeLeft}
        </div>
    );
}

// Direct Chat Component
function DirectChat({ auctionId, currentUserEmail }) {
    const [msg, setMsg] = useState("");
    const [chat, setChat] = useState([]);
    useEffect(() => {
        return window.fb.onSnapshot(window.fb.doc(window.db, "auctions", auctionId), (doc) => {
            setChat(doc.data().messages || []);
        });
    }, [auctionId]);
    const sendMsg = async () => {
        if (!msg) return;
        await window.fb.updateDoc(window.fb.doc(window.db, "auctions", auctionId), {
            messages: window.fb.arrayUnion({ sender: currentUserEmail, text: msg, time: new Date().toLocaleTimeString() })
        });
        setMsg("");
    };
    return (
        <div className="mt-6 border-t pt-6">
            <p className="text-[10px] font-black uppercase text-indigo-600 mb-4 tracking-widest">Secure Project Messenger</p>
            <div className="bg-slate-50 rounded-2xl p-4 h-48 overflow-y-auto mb-4 flex flex-col gap-2 shadow-inner">
                {chat.map((c, i) => (
                    <div key={i} className={`max-w-[85%] p-3 rounded-2xl text-[11px] font-bold shadow-sm ${c.sender === currentUserEmail ? 'self-end bg-indigo-600 text-white' : 'self-start bg-white text-slate-800'}`}>
                        {c.text}
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <input className="flex-1 bg-white border-2 p-3 rounded-xl text-sm outline-none focus:border-indigo-600" placeholder="Type message..." value={msg} onChange={e => setMsg(e.target.value)} />
                <button onClick={sendMsg} className="bg-slate-900 text-white px-6 rounded-xl font-black text-[10px]">SEND</button>
            </div>
        </div>
    );
}

function App() {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('dashboard');
    const [notifications, setNotifications] = useState([]);
    const lastBidCount = useRef({});

    useEffect(() => {
        const unsubAuth = window.fb.onAuthStateChanged(window.auth, async (u) => {
            if (u) {
                const docSnap = await window.fb.getDoc(window.fb.doc(window.db, "users", u.uid));
                if (docSnap.exists()) {
                    setRole(docSnap.data().role);
                    setUserData(docSnap.data());
                    const q = window.fb.query(window.fb.collection(window.db, "auctions"), window.fb.where("owner", "==", u.uid));
                    window.fb.onSnapshot(q, (snap) => {
                        snap.docs.forEach(doc => {
                            const current = doc.data().bids?.length || 0;
                            if (current > (lastBidCount.current[doc.id] || 0)) {
                                setNotifications(prev => [{ id: Date.now(), text: `New bid on "${doc.data().title}"`, time: new Date().toLocaleTimeString() }, ...prev]);
                            }
                            lastBidCount.current[doc.id] = current;
                        });
                    });
                }
                setUser(u);
            } else { setUser(null); }
            setLoading(false);
        });
        return unsubAuth;
    }, []);

    const refreshUserData = async () => {
        const docSnap = await window.fb.getDoc(window.fb.doc(window.db, "users", user.uid));
        if (docSnap.exists()) setUserData(docSnap.data());
    };

    if (loading) return <div className="h-screen flex items-center justify-center font-black text-indigo-600 animate-pulse text-2xl italic">ELITE MARKET INITIALIZING...</div>;

    return (
        <div className="min-h-screen">
            {!user ? <LoginGate /> : (
                <div>
                    <Navbar role={role} setView={setView} activeView={view} notifications={notifications} setNotifications={setNotifications} />
                    <main className="pb-20">
                        {view === 'dashboard' && <Dashboard />}
                        {view === 'auction' && <AuctionCenter user={user} role={role} setNotifications={setNotifications} />}
                        {view === 'assignments' && <AssignmentsList user={user} role={role} />}
                        {view === 'profile' && <ProfileEditor userData={userData} refresh={refreshUserData} />}
                    </main>
                </div>
            )}
        </div>
    );
}

function Navbar({ role, setView, activeView, notifications, setNotifications }) {
    const [showNotif, setShowNotif] = useState(false);
    return (
        <nav className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
                <div className="bg-indigo-600 text-white px-3 py-1 rounded-xl font-black">EM</div>
                <span className="font-extrabold hidden sm:block tracking-tight text-lg uppercase">Elite Market</span>
            </div>
            <div className="flex gap-4 sm:gap-8 font-bold text-[10px] tracking-widest uppercase items-center">
                <button onClick={() => setView('dashboard')} className={activeView === 'dashboard' ? 'text-indigo-600 border-b-2 border-indigo-600 pb-1' : 'text-slate-400'}>Explore</button>
                <button onClick={() => setView('auction')} className={activeView === 'auction' ? 'text-indigo-600 border-b-2 border-indigo-600 pb-1' : 'text-slate-400'}>Arena</button>
                {role === 'employee' && (
                    <button onClick={() => setView('assignments')} className={activeView === 'assignments' ? 'text-indigo-600 border-b-2 border-indigo-600 pb-1' : 'text-slate-400'}>Assignments</button>
                )}
                <div className="relative">
                    <button onClick={() => setShowNotif(!showNotif)} className={`relative p-2 rounded-full hover:bg-slate-100 transition ${notifications.length > 0 ? 'notify-pulse text-red-500' : 'text-slate-400'}`}>
                        🔔 {notifications.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] px-1 rounded-full">{notifications.length}</span>}
                    </button>
                    {showNotif && (
                        <div className="absolute top-12 right-0 bg-white border shadow-2xl rounded-2xl w-64 p-4 z-[100] animate-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-3 font-black text-[10px] text-slate-400">Activity<button onClick={() => setNotifications([])} className="text-indigo-600 underline">Clear</button></div>
                            <div className="max-h-48 overflow-y-auto space-y-2">
                                {notifications.length === 0 ? <p className="text-[10px] text-slate-300 text-center py-4 font-bold italic">No alerts</p> : 
                                    notifications.map(n => (<div key={n.id} className="p-2 bg-slate-50 rounded-lg border-l-4 border-indigo-500 text-[10px] font-bold">{n.text}<br/><span className="text-[8px] opacity-40">{n.time}</span></div>))
                                }
                            </div>
                        </div>
                    )}
                </div>
                <button onClick={() => setView('profile')} className={activeView === 'profile' ? 'text-indigo-600 border-b-2 border-indigo-600 pb-1' : 'text-slate-400'}>Settings</button>
            </div>
            <button onClick={() => window.auth.signOut()} className="text-[10px] font-black border-2 px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition uppercase">Exit</button>
        </nav>
    );
}

function LoginGate() {
    const [isLogin, setIsLogin] = useState(true);
    const [forgotMode, setForgotMode] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [role, setRole] = useState('user');
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [recoveryAnswer, setRecoveryAnswer] = useState('');
    const [formData, setFormData] = useState({ 
        email: '', password: '', name: '', location: '', phone: '', 
        idNumber: '', photoURL: '', expYears: '', pastProjects: '',
        securityQuestion: 'What is your pet name?', securityAnswer: '' 
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isLogin) { await window.fb.signInWithEmailAndPassword(window.auth, formData.email, formData.password); }
            else {
                const res = await window.fb.createUserWithEmailAndPassword(window.auth, formData.email, formData.password);
                const profile = { 
                    uid: res.user.uid, role, name: formData.name, email: formData.email, location: formData.location, 
                    securityQuestion: formData.securityQuestion, securityAnswer: formData.securityAnswer.toLowerCase(), 
                    completedJobs: 0, rating: 5.0, status: 'active', hourlyRate: '25',
                    ...(role === 'employee' && { 
                        phone: formData.phone, idNumber: formData.idNumber, 
                        photoURL: formData.photoURL || `https://i.pravatar.cc/150?u=${res.user.uid}`, 
                        experience: formData.expYears, pastWork: formData.pastProjects 
                    }) 
                };
                await window.fb.setDoc(window.fb.doc(window.db, "users", res.user.uid), profile);
            }
        } catch (err) { alert(err.message); }
    };

    const handleRecovery = async (e) => {
        e.preventDefault();
        const q = window.fb.query(window.fb.collection(window.db, "users"), window.fb.where("email", "==", recoveryEmail));
        const snap = await window.fb.getDocs(q);
        if (!snap.empty && snap.docs[0].data().securityAnswer === recoveryAnswer.toLowerCase()) {
            alert("Confirmed! Emergency access code: reset123. Use it to login and change your password."); setForgotMode(false);
        } else { alert("Verification failed."); }
    };

    if (forgotMode) return (
        <div className="min-h-screen bg-indigo-900 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl">
                <h2 className="text-3xl font-black text-center mb-6">Security Check</h2>
                <form onSubmit={handleRecovery} className="space-y-4">
                    <input required className="w-full border-2 p-4 rounded-2xl outline-none" type="email" placeholder="Recovery Email" onChange={e => setRecoveryEmail(e.target.value)} />
                    <input required className="w-full border-2 p-4 rounded-2xl outline-none" placeholder="Your Security Answer" onChange={e => setRecoveryAnswer(e.target.value)} />
                    <button className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black uppercase shadow-lg">Verify</button>
                </form>
                <p onClick={() => setForgotMode(false)} className="text-center mt-6 text-slate-400 font-bold cursor-pointer text-[10px] uppercase underline">Return</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-indigo-600 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-2xl p-10 rounded-[2.5rem] shadow-2xl overflow-y-auto max-h-[95vh]">
                <h2 className="text-3xl font-black text-center mb-6 tracking-tight uppercase italic">{isLogin ? 'Member Login' : 'Elite Registration'}</h2>
                {!isLogin && (
                    <div className="flex gap-2 mb-8 bg-slate-100 p-1 rounded-2xl">
                        <button onClick={() => setRole('user')} className={`flex-1 py-3 rounded-xl font-black text-[10px] ${role === 'user' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>HIRE</button>
                        <button onClick={() => setRole('employee')} className={`flex-1 py-3 rounded-xl font-black text-[10px] ${role === 'employee' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>WORK</button>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && <input required className="w-full border-2 border-slate-50 p-4 rounded-2xl outline-none" placeholder="Full Name" onChange={e => setFormData({...formData, name: e.target.value})} />}
                    <input required className="w-full border-2 border-slate-50 p-4 rounded-2xl outline-none" type="email" placeholder="Email Address" onChange={e => setFormData({...formData, email: e.target.value})} />
                    
                    {!isLogin && role === 'employee' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input required className="border-2 p-4 rounded-2xl outline-none" placeholder="Contact Phone" onChange={e => setFormData({...formData, phone: e.target.value})} />
                            <input required className="border-2 p-4 rounded-2xl outline-none" placeholder="National ID (Aadhar/Passport)" onChange={e => setFormData({...formData, idNumber: e.target.value})} />
                            <input required className="border-2 p-4 rounded-2xl outline-none" type="number" placeholder="Experience Years" onChange={e => setFormData({...formData, expYears: e.target.value})} />
                            <input className="border-2 p-4 rounded-2xl outline-none" placeholder="Profile Image URL" onChange={e => setFormData({...formData, photoURL: e.target.value})} />
                            <textarea required className="md:col-span-2 border-2 p-4 rounded-2xl outline-none h-24" placeholder="Describe your past projects and skills..." onChange={e => setFormData({...formData, pastProjects: e.target.value})} />
                        </div>
                    )}

                    {!isLogin && (
                        <div className="bg-indigo-50 p-5 rounded-2xl">
                            <label className="text-[10px] font-black uppercase text-indigo-600 mb-2 block">Account Recovery</label>
                            <select className="w-full bg-transparent border-b-2 border-indigo-200 outline-none mb-4 text-xs font-bold" onChange={e => setFormData({...formData, securityQuestion: e.target.value})}>
                                <option>What is your pet name?</option><option>What was your first car?</option>
                            </select>
                            <input required className="w-full bg-transparent border-b-2 border-indigo-200 outline-none p-2" placeholder="Your Answer" onChange={e => setFormData({...formData, securityAnswer: e.target.value})} />
                        </div>
                    )}

                    <div className="relative">
                        <input required className="w-full border-2 border-slate-50 p-4 rounded-2xl outline-none" type={showPass ? "text" : "password"} placeholder="Password" onChange={e => setFormData({...formData, password: e.target.value})} />
                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-4 text-[10px] font-black text-indigo-600 bg-white px-2 py-1 rounded-lg border shadow-sm uppercase">{showPass ? "Hide" : "Show"}</button>
                    </div>
                    <button className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black shadow-xl hover:bg-indigo-700 transition uppercase tracking-widest">Continue</button>
                </form>
                <div className="flex justify-between mt-8">
                    <p onClick={() => setIsLogin(!isLogin)} className="text-slate-400 font-bold cursor-pointer text-[10px] uppercase underline">{isLogin ? "Sign Up" : "Back to Login"}</p>
                    {isLogin && <p onClick={() => setForgotMode(true)} className="text-red-400 font-bold cursor-pointer text-[10px] uppercase underline">Reset Password?</p>}
                </div>
            </div>
        </div>
    );
}

function Dashboard() {
    const [search, setSearch] = useState("");
    const [dbWorkers, setDbWorkers] = useState([]);
    useEffect(() => {
        const q = window.fb.query(window.fb.collection(window.db, "users"), window.fb.where("role", "==", "employee"));
        return window.fb.onSnapshot(q, snap => setDbWorkers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    }, []);
    return (
        <div className="p-6 md:p-12 max-w-7xl mx-auto">
            <h1 className="text-5xl font-black tracking-tighter mb-8 uppercase italic">Talent Hub</h1>
            <input className="w-full bg-white border-2 p-8 rounded-[2.5rem] pl-10 outline-none shadow-sm mb-12 font-bold focus:border-indigo-600" placeholder="🔍 Search expert services..." onChange={e => setSearch(e.target.value)} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {dbWorkers.filter(w => (w.name?.toLowerCase() || "").includes(search.toLowerCase())).map(w => {
                    const rep = getReputationBadge(w.completedJobs || 0, w.rating || 5);
                    return (
                        <div key={w.id} className="bg-white rounded-[3rem] p-8 border hover:shadow-2xl transition duration-500 overflow-hidden relative group">
                            {w.bannerURL && <div className="h-24 -m-8 mb-4 bg-cover bg-center" style={{backgroundImage: `url(${w.bannerURL})`}}></div>}
                            <div className="flex items-center gap-4 mb-6">
                                <img src={w.photoURL || `https://i.pravatar.cc/150?u=${w.id}`} className="w-16 h-16 rounded-2xl object-cover shadow-md" />
                                <div><h3 className="text-xl font-bold">{w.name}</h3><p className="text-[10px] font-black text-indigo-600 uppercase">{w.category}</p>
                                <div className={`text-[8px] font-black text-white px-2 py-0.5 rounded-full mt-1 inline-block ${rep.color}`}>{rep.icon} {rep.label}</div></div>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl mb-8 min-h-[100px] border shadow-inner"><p className="text-sm font-semibold text-slate-500 italic">"{w.pastWork}"</p></div>
                            <div className="flex justify-between items-center"><div className="bg-amber-50 text-amber-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">★ {w.rating} ({w.completedJobs || 0} Jobs)</div><button className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-indigo-600">Connect</button></div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function AuctionCenter({ user, role, setNotifications }) {
    const [auctions, setAuctions] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [newAuc, setNewAuc] = useState({ title: '', desc: '', budget: '', time: '24' });
    const [bidPrice, setBidPrice] = useState('');
    const [reviewData, setReviewData] = useState({ rating: 5, comment: '' });

    useEffect(() => {
        const q = window.fb.query(window.fb.collection(window.db, "auctions"), window.fb.orderBy("deadline", "desc"));
        return window.fb.onSnapshot(q, snap => setAuctions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    const createAuction = async () => {
        const deadline = new Date(); deadline.setHours(deadline.getHours() + parseInt(newAuc.time));
        await window.fb.addDoc(window.fb.collection(window.db, "auctions"), { 
            title: newAuc.title, desc: newAuc.desc, budget: newAuc.budget, deadline: deadline.toISOString(), 
            owner: user.uid, ownerEmail: user.email, bids: [], status: 'active', messages: [] 
        });
        setShowForm(false);
    };

    const placeBid = async (id) => {
        await window.fb.updateDoc(window.fb.doc(window.db, "auctions", id), { bids: window.fb.arrayUnion({ bidder: user.email, amount: bidPrice, time: new Date().toISOString() }) });
        setBidPrice(''); alert("Proposal Broadcasted!");
    };

    const handleAccept = async (aucId, winnerEmail) => {
        if (confirm(`Hire this professional?`)) await window.fb.updateDoc(window.fb.doc(window.db, "auctions", aucId), { status: 'closed', winner: winnerEmail });
    };

    const submitReview = async (aucId) => {
        await window.fb.updateDoc(window.fb.doc(window.db, "auctions", aucId), { review: reviewData });
        alert("Review Published!");
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-12"><h1 className="text-4xl font-black tracking-tight uppercase italic text-slate-800">Arena</h1>{role === 'user' && <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase shadow-xl">{showForm ? 'Cancel' : 'Post Project'}</button>}</div>
            {showForm && (
                <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 mb-12 space-y-4 animate-in slide-in-from-top-4">
                    <input className="w-full border-2 p-5 rounded-2xl font-bold" placeholder="Task Name" onChange={e => setNewAuc({...newAuc, title: e.target.value})} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input className="border-2 p-5 rounded-2xl font-bold" type="number" placeholder="Budget ($)" onChange={e => setNewAuc({...newAuc, budget: e.target.value})} /><select className="border-2 p-5 rounded-2xl font-bold" onChange={e => setNewAuc({...newAuc, time: e.target.value})}><option value="24">24h</option><option value="48">48h</option></select></div>
                    <textarea className="w-full border-2 p-5 rounded-2xl h-32 font-bold" placeholder="Instructions..." onChange={e => setNewAuc({...newAuc, desc: e.target.value})} />
                    <button onClick={createAuction} className="w-full bg-slate-900 text-white p-6 rounded-3xl font-black uppercase shadow-xl hover:bg-indigo-600 transition">Broadcast</button>
                </div>
            )}
            <div className="space-y-8">
                {auctions.map(auc => (
                    <div key={auc.id} className={`bg-white p-10 rounded-[3.5rem] border shadow-sm transition-all ${auc.status === 'completed' ? 'border-amber-400 bg-amber-50' : (auc.status === 'closed' ? 'opacity-70' : 'hover:shadow-xl')}`}>
                        <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3"><AuctionTimer deadline={auc.deadline} status={auc.status} /><span className="bg-indigo-50 text-indigo-600 px-4 py-1 rounded-full text-[10px] font-black uppercase">Budget: ${auc.budget}</span></div>
                                <h3 className="text-3xl font-black tracking-tight mb-2">{auc.title}</h3>
                                <p className="text-slate-400 text-sm font-semibold italic">"{auc.desc}"</p>
                            </div>
                            <div className="text-right">{auc.status === 'completed' ? <span className="bg-amber-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase shadow-lg">Finished</span> : <p className="font-extrabold text-sm opacity-20">{auc.ownerEmail.split('@')[0]}</p>}</div>
                        </div>
                        {auc.status === 'active' ? (
                            role === 'employee' ? (
                                <div className="flex gap-4 p-2 bg-slate-50 rounded-[2.5rem] shadow-inner">
                                    <input type="number" className="border-2 p-5 rounded-2xl flex-1 font-extrabold outline-none" placeholder="Bid Amount ($)" value={bidPrice} onChange={e => setBidPrice(e.target.value)} />
                                    <button onClick={() => placeBid(auc.id)} className="bg-indigo-600 text-white px-10 rounded-2xl font-black uppercase text-[10px] shadow-lg">Bid</button>
                                </div>
                            ) : (
                                <div className="bg-slate-50 p-8 rounded-[2.5rem] border shadow-inner">
                                    <h4 className="font-black text-[10px] text-slate-500 uppercase mb-6 tracking-widest">Offers ({auc.bids.length})</h4>
                                    <div className="space-y-4">
                                        {auc.bids.map((b, i) => (
                                            <div key={i} className="flex justify-between items-center p-5 bg-white rounded-3xl border shadow-sm">
                                                <span className="text-[12px] font-black">{b.bidder.split('@')[0]}</span>
                                                <div className="flex items-center gap-4"><span className="font-black text-green-600 text-2xl tracking-tighter">${b.amount}</span><button onClick={() => handleAccept(auc.id, b.bidder)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-green-600 transition">Approve</button></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="p-8 rounded-[2.5rem] border-2 text-center uppercase font-black text-sm italic border-indigo-200 bg-indigo-50 text-indigo-600">
                                {auc.status === 'closed' ? "In Progress - Winner assigned" : "Mission Accomplished"}
                            </div>
                        )}
                        {auc.status === 'completed' && role === 'user' && auc.owner === user.uid && !auc.review && (
                            <div className="mt-8 bg-white p-8 rounded-[2.5rem] border-2 border-amber-200 shadow-xl space-y-4 animate-in slide-in-from-bottom-2">
                                <h4 className="font-black uppercase text-[12px] text-amber-600 italic tracking-widest text-center">Rate your experience</h4>
                                <div className="flex flex-col md:flex-row gap-4 items-center">
                                    <select className="border-2 p-3 rounded-xl font-bold w-full md:w-auto" value={reviewData.rating} onChange={e => setReviewData({...reviewData, rating: e.target.value})}><option>1</option><option>2</option><option>3</option><option>4</option><option value="5">5 Stars</option></select>
                                    <input className="flex-1 border-2 p-3 rounded-xl font-bold w-full" placeholder="How did the pro perform?" onChange={e => setReviewData({...reviewData, comment: e.target.value})} />
                                    <button onClick={() => submitReview(auc.id)} className="bg-amber-500 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase w-full md:w-auto shadow-lg">Post</button>
                                </div>
                            </div>
                        )}
                        {auc.review && (
                            <div className="mt-6 bg-amber-50 p-6 rounded-3xl border-l-8 border-amber-400">
                                <p className="text-[10px] font-black uppercase text-amber-600">Verified Review ★ {auc.review.rating}</p>
                                <p className="text-sm font-bold italic text-slate-600 mt-1">"{auc.review.comment}"</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function AssignmentsList({ user, role }) {
    const [wonAuctions, setWonAuctions] = useState([]);
    useEffect(() => {
        const targetKey = role === 'employee' ? "winner" : "ownerEmail";
        const q = window.fb.query(window.fb.collection(window.db, "auctions"), window.fb.where(targetKey, "==", role === 'employee' ? user.email : user.email));
        return window.fb.onSnapshot(q, snap => setWonAuctions(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.status !== 'active')));
    }, [user.email]);
    
    const markComplete = async (aucId) => {
        if (confirm("Deliver finalized project?")) {
            await window.fb.updateDoc(window.fb.doc(window.db, "auctions", aucId), { status: 'completed' });
            const q = window.fb.query(window.fb.collection(window.db, "users"), window.fb.where("email", "==", user.email));
            const snap = await window.fb.getDocs(q);
            if (!snap.empty) {
                const uid = snap.docs[0].id;
                const current = snap.docs[0].data().completedJobs || 0;
                await window.fb.updateDoc(window.fb.doc(window.db, "users", uid), { completedJobs: current + 1 });
            }
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <h1 className="text-4xl font-black mb-12 uppercase italic tracking-tighter">Secure Assignments</h1>
            <div className="space-y-6">
                {wonAuctions.map(auc => (
                    <div key={auc.id} className={`p-10 rounded-[3rem] border shadow-sm ${auc.status === 'completed' ? 'bg-slate-50 opacity-60' : 'bg-white border-indigo-100 shadow-xl'}`}>
                        <div className="flex justify-between items-center mb-6">
                            <div className="px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-green-100 text-green-600">{auc.status}</div>
                            <div className="font-black text-indigo-600 text-2xl tracking-tighter">${auc.budget}</div>
                        </div>
                        <h3 className="text-2xl font-black mb-2">{auc.title}</h3>
                        <p className="text-slate-400 text-sm mb-6 font-semibold italic">"{auc.desc}"</p>
                        <div className="bg-slate-50 p-6 rounded-2xl border flex flex-col md:flex-row justify-between items-center gap-4">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Partner: {role === 'employee' ? auc.ownerEmail : auc.winner}</span>
                            {auc.status !== 'completed' && role === 'employee' && <button onClick={() => markComplete(auc.id)} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-[9px] uppercase shadow-lg hover:bg-amber-500 transition">Mark Done</button>}
                        </div>
                        {auc.status === 'closed' && <DirectChat auctionId={auc.id} currentUserEmail={user.email} />}
                    </div>
                ))}
            </div>
        </div>
    );
}

function ProfileEditor({ userData, refresh }) {
    const [form, setForm] = useState({...userData});
    const handleUpdate = async (e) => {
        e.preventDefault(); await window.fb.updateDoc(window.fb.doc(window.db, "users", userData.uid), form);
        await refresh(); alert("Master Profile Updated!");
    };
    const rep = getReputationBadge(form.completedJobs || 0, form.rating || 5);
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h2 className="text-4xl font-black mb-8 text-center uppercase italic tracking-widest">Digital Persona</h2>
            <form onSubmit={handleUpdate} className="bg-white p-12 rounded-[3.5rem] shadow-2xl space-y-8 border relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-32 bg-slate-900 z-0 overflow-hidden">
                    {form.bannerURL ? <img src={form.bannerURL} className="w-full h-full object-cover opacity-50" /> : <div className="w-full h-full bg-indigo-600 opacity-20"></div>}
                </div>
                <div className="relative z-10 pt-16">
                    <div className={`mb-8 inline-flex items-center gap-2 px-6 py-2 rounded-full text-white font-black text-[11px] uppercase shadow-2xl ${rep.color}`}>{rep.icon} Current Status: {rep.label}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Public Alias</label><input className="w-full border-2 p-5 rounded-2xl font-bold bg-slate-50 outline-none focus:border-indigo-600" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rate ($/hr)</label><input type="number" className="w-full border-2 p-5 rounded-2xl font-bold bg-slate-50 outline-none" value={form.hourlyRate} onChange={e => setForm({...form, hourlyRate: e.target.value})} /></div>
                                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Availability</label><select className="w-full border-2 p-5 rounded-2xl font-bold bg-slate-50 outline-none" value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option value="active">Active</option><option value="away">Away</option></select></div>
                            </div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Biography</label><textarea className="w-full border-2 p-5 rounded-2xl h-40 font-bold bg-slate-50 outline-none focus:border-indigo-600 shadow-inner" value={form.pastWork} onChange={e => setForm({...form, pastWork: e.target.value})} /></div>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expert Skills</label><input className="w-full border-2 p-5 rounded-2xl font-bold bg-slate-50 outline-none" placeholder="React, Plumbing, Marketing" value={form.skills} onChange={e => setForm({...form, skills: e.target.value})} /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Banner Link</label><input className="w-full border-2 p-5 rounded-2xl font-bold bg-slate-50 outline-none" placeholder="Header image URL" value={form.bannerURL} onChange={e => setForm({...form, bannerURL: e.target.value})} /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avatar Link</label><input className="w-full border-2 p-5 rounded-2xl font-bold bg-slate-50 outline-none" placeholder="Profile pic URL" value={form.photoURL} onChange={e => setForm({...form, photoURL: e.target.value})} /></div>
                            <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Portfolio Link</label><input className="w-full border-2 p-5 rounded-2xl font-bold bg-slate-50 outline-none" placeholder="Website or LinkedIn" value={form.website} onChange={e => setForm({...form, website: e.target.value})} /></div>
                        </div>
                    </div>
                </div>
                <button className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-600 transition-all text-sm">Save Master Settings</button>
            </form>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);