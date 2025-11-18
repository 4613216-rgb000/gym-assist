import { BrowserRouter, Routes, Route, Navigate, Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from './stores/auth';
import { notificationService } from './lib/notificationService';
import { Pencil, ListChecks, CalendarDays, Cog, User, UserCog, Users, LogOut } from 'lucide-react';
import Login from './pages/Login';
import Home from './pages/Home';
import Search from './pages/Search';
import Manage from './pages/Manage';
import Alerts from './pages/Alerts';
import Overview from './pages/Overview';
import Settings from './pages/Settings';

function Layout() {
  const { signOut } = useAuth();
  const location = useLocation();
  const [userOpen, setUserOpen] = useState(false);
  const [lang, setLang] = useState<'en'|'zh'>(() => (localStorage.getItem('settings.language') || 'en') as 'en'|'zh')
  const linkBase = 'text-sm px-3 py-2 rounded flex items-center gap-2';
  const active = (path: string) => location.pathname === path;
  useEffect(() => {
    const onUpdated = () => setLang((localStorage.getItem('settings.language') || 'en') as 'en'|'zh')
    window.addEventListener('settings-updated', onUpdated as EventListener)
    return () => window.removeEventListener('settings-updated', onUpdated as EventListener)
  }, [])
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 w-56 border-r bg-gray-50 flex flex-col">
        <div className="px-3 py-4 font-semibold">{lang === 'zh' ? '待办清单' : 'todolist'}</div>
        <div className="px-2">
          <div className="relative">
            <button
              type="button"
              className={`${linkBase} hover:bg-gray-100 w-full relative z-20`}
              onClick={() => setUserOpen((v) => !v)}
              aria-expanded={userOpen}
            >
              <User size={16} />
              <span className="relative inline-block px-2 py-0.5">
                <span className="absolute inset-0 rounded-full bg-blue-300 opacity-70" />
                <span className="relative">{lang === 'zh' ? '用户' : 'user'}</span>
              </span>
              <span className={`ml-1 text-gray-500 transition-transform ${userOpen ? 'transform rotate-90' : ''}`}>{'>'}</span>
            </button>
            {userOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 space-y-1 z-10">
                <button type="button" className={`${linkBase} opacity-50 cursor-not-allowed`} aria-disabled="true">
                  <User size={16} />
                  <span>{lang === 'zh' ? '个人资料' : 'profile'}</span>
                </button>
                <button type="button" className={`${linkBase} opacity-50 cursor-not-allowed`} aria-disabled="true">
                  <UserCog size={16} />
                  <span>{lang === 'zh' ? '账户设置' : 'account'}</span>
                </button>
                <button type="button" className={`${linkBase} opacity-50 cursor-not-allowed`} aria-disabled="true">
                  <Users size={16} />
                  <span>{lang === 'zh' ? '切换用户' : 'switch'}</span>
                </button>
                <button type="button" onClick={signOut} className={`${linkBase} hover:bg-gray-100`}>
                  <LogOut size={16} />
                  <span>{lang === 'zh' ? '退出登录' : 'logout'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-1 flex flex-col justify-center">
          <Link to="/" className={`${linkBase} ${active('/') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>
            <Pencil size={16} />
            <span>{lang === 'zh' ? '创建待办' : 'create'}</span>
          </Link>
          <Link to="/manage" className={`${linkBase} ${active('/manage') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>
            <ListChecks size={16} />
            <span>{lang === 'zh' ? '管理待办' : 'manage'}</span>
          </Link>
          <Link to="/overview" className={`${linkBase} ${active('/overview') ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}>
            <CalendarDays size={16} />
            <span>{lang === 'zh' ? '日历视图' : 'overview'}</span>
          </Link>
        </nav>
        <div className="px-2 py-3 border-t">
          <Link to="/settings" className={`${linkBase} hover:bg-gray-100`}>
            <Cog size={16} />
            <span>{lang === 'zh' ? '设置' : 'settings'}</span>
          </Link>
        </div>
      </aside>
      <main className="ml-56">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  const { user, checkSession } = useAuth();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (user?.id) {
      notificationService.connect(user.id);
    }
    return () => {
      notificationService.disconnect();
    };
  }, [user?.id]);

  if (!user) return <Login />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/search" element={<Search />} />
          <Route path="/manage" element={<Manage />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
