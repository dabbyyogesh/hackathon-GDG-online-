// app.js
const { useState, useEffect, useMemo, useRef } = React;

const CATEGORIES = ["All", "Technical", "Home Services", "Creative", "Health"];

// Reputation Tier Logic
function getReputationBadge(completedCount, avgRating) {
    if (completedCount >= 6 && avgRating >= 4.8) return { label: "Elite Gold", color: "bg-amber-500", icon: "🔱" };
    if (completedCount >= 3 && avgRating >= 4.5) return { label: "Top Performer", color: "bg-indigo-600", icon: "🏆" };
    if (completedCount >= 1) return { label: "Rising Star", color: "bg-green-500", icon: "🚀" };
    return { label: "New Pro", color: "bg-slate-400", icon: "✨" };
}

// --- APP ROOT COMPONENT ---
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
                            if ((doc.data().bids?.length || 0) > (lastBidCount.current[doc.id] || 0)) {
                                setNotifications(prev => [{ id: Date.now(), text: `New bid on "${doc.data().title}"`, time: new Date().toLocaleTimeString() }, ...prev]);
                            }
                            lastBidCount.current[doc.id] = doc.data().bids?.length || 0;
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

    if (loading) return <div className="h-screen flex items-center justify-center font-black text-indigo-600 animate-pulse text-2xl uppercase">Elite Market...</div>;

    return (
        <div className="min-h-screen">
            {!user ? <LoginGate /> : (
                <div>
                    <Navbar role={role} setView={setView} activeView={view} notifications={notifications} setNotifications={setNotifications} />
                    <main className="pb-20">
                        {view === 'dashboard' && <Dashboard />}
                        {view === 'auction' && <AuctionCenter user={user} role={role} setNotifications={setNotifications} />}
                        {view === 'assignments' && <AssignmentsList user={user} />}
                        {view === 'profile' && <ProfileEditor userData={userData} refresh={refreshUserData} />}
                    </main>
                </div>
            )}
        </div>
    );
}

// ... All previously developed React components go here ...
// Ensure you include Navbar, LoginGate, Dashboard, AuctionCenter, AssignmentsList, and ProfileEditor.

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
